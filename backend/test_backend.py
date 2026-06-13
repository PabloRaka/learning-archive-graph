import sys
from datetime import date
from sqlmodel import Session, select

# Add parent dir to path to import app modules
sys.path.append(".")

from app.core.database import init_db, engine
from app.models.models import Category, LearningEntry, Connection
from app.repositories import crud
from app.models.models import CategoryCreate, LearningEntryCreate, ConnectionCreate

def run_tests():
    print("=== STARTING BACKEND INTEGRATION TESTS ===")
    
    # 1. Initialize database and create tables
    init_db()
    print("[1] Database initialized successfully.")
    
    with Session(engine) as session:
        # Clear existing data for a clean test run
        print("Cleaning up old test data...")
        session.exec(select(Connection)).all()
        for conn in session.exec(select(Connection)).all():
            session.delete(conn)
        for learn in session.exec(select(LearningEntry)).all():
            session.delete(learn)
        for cat in session.exec(select(Category)).all():
            session.delete(cat)
        session.commit()
        
        # 2. Test Category Creation
        print("\nTesting Category CRUD...")
        cat1 = crud.create_category(session, CategoryCreate(
            name="Computer Science",
            description="Foundational algorithms and data structures"
        ))
        cat2 = crud.create_category(session, CategoryCreate(
            name="Web Development",
            description="Frontend & Backend technologies"
        ))
        
        categories = crud.get_categories(session)
        assert len(categories) == 2, f"Expected 2 categories, got {len(categories)}"
        print(f"-> Created categories: {[c.name for c in categories]}")
        
        # 3. Test Learning Entry Creation
        print("\nTesting Learning Log CRUD...")
        learn1 = crud.create_learning(session, LearningEntryCreate(
            title="FastAPI Clean Architecture",
            content="Learned modular clean architecture for REST APIs in FastAPI.",
            date=date.today(),
            primary_category_id=cat2.id
        ))
        
        learnings = crud.get_learnings(session)
        assert len(learnings) == 1, f"Expected 1 learning entry, got {len(learnings)}"
        print(f"-> Created learning entry: '{learnings[0].title}' under category '{cat2.name}'")
        
        # 4. Test Auto-linking and manual connections
        print("\nTesting Graph Connections...")
        # Auto-link should connect learn1 to cat2 (primary category)
        # Let's do it manually since crud.create_learning is low-level, 
        # and the router layer manages the auto-linking logic.
        conn_primary = crud.create_connection(session, ConnectionCreate(
            source_id=learn1.id,
            target_id=cat2.id,
            type="entry-category"
        ))
        
        # Manually link learning log to another category (CS foundation)
        conn_cross = crud.create_connection(session, ConnectionCreate(
            source_id=learn1.id,
            target_id=cat1.id,
            type="entry-category"
        ))
        
        # Link category to category
        conn_cat = crud.create_connection(session, ConnectionCreate(
            source_id=cat2.id,
            target_id=cat1.id,
            type="category-category"
        ))
        
        connections = crud.get_connections(session)
        assert len(connections) == 3, f"Expected 3 connections, got {len(connections)}"
        print(f"-> Formed graph links:")
        for c in connections:
            print(f"   [{c.type}] Link from {c.source_id} to {c.target_id}")

        # 5. Test Cascading Deletions
        print("\nTesting cascading deletions...")
        # Deleting category 2 should cascade delete learning 1 and clean up its connections!
        crud.delete_category(session, cat2.id)
        
        remaining_cats = crud.get_categories(session)
        remaining_learnings = crud.get_learnings(session)
        remaining_connections = crud.get_connections(session)
        
        assert len(remaining_cats) == 1, "Category 1 should remain"
        assert len(remaining_learnings) == 0, "Learning 1 should be cascaded"
        assert len(remaining_connections) == 0, "All connections should be cleared"
        
        print("-> Cascade deletion verified successfully!")
        print("   Remaining categories: CS")
        print("   Remaining learning logs: 0")
        print("   Remaining active links: 0")
        
    print("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()
