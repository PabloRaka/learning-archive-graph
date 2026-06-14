import sys
import logging
from datetime import date
from sqlmodel import Session, select

# Add parent dir to path to import app modules
sys.path.append(".")

from app.core.database import init_db, engine
from app.models.models import Category, LearningEntry, Connection
from app.repositories import crud
from app.models.models import CategoryCreate, LearningEntryCreate, ConnectionCreate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_db():
    init_db()
    logger.info("Database initialized.")
    
    with Session(engine) as session:
        # Check if database already has categories
        existing_cats = session.exec(select(Category)).all()
        if existing_cats:
            logger.info("Database already seeded. Skipping.")
            return

        logger.info("Seeding categories...")
        # 1. Create categories
        cat_web = crud.create_category(session, CategoryCreate(
            name="Web Development",
            description="Frontend and backend web applications, APIs, UI components, states, styling"
        ))
        
        cat_data = crud.create_category(session, CategoryCreate(
            name="Data Science",
            description="Data analysis, statistics, data manipulation, visualization, scientific calculations"
        ))
        
        cat_ml = crud.create_category(session, CategoryCreate(
            name="Machine Learning",
            description="Supervised and unsupervised learning, neural networks, natural language processing, vector embeddings"
        ))
        
        logger.info("Seeding learning entries...")
        # 2. Create learning entries
        learn_react = crud.create_learning(session, LearningEntryCreate(
            title="React Hooks & State Management",
            content="Learn how to use React hooks like useState, useEffect, and useContext to manage UI states and handle side-effects in component lifecycles.",
            date=date.today(),
            primary_category_id=cat_web.id
        ))

        learn_fastapi = crud.create_learning(session, LearningEntryCreate(
            title="FastAPI Routing & HTTP Endpoints",
            content="Implement RESTful API routers in Python using FastAPI, utilizing Depends for dependency injection of databases and models.",
            date=date.today(),
            primary_category_id=cat_web.id
        ))

        learn_pandas = crud.create_learning(session, LearningEntryCreate(
            title="NumPy & Pandas Data Analysis",
            content="Use Pandas DataFrames and NumPy arrays to load, clean, analyze, group, and visualize large tabular datasets efficiently in Python.",
            date=date.today(),
            primary_category_id=cat_data.id
        ))

        learn_vector = crud.create_learning(session, LearningEntryCreate(
            title="Text Embeddings & Vector Search",
            content="Generate high-dimensional vector embeddings for text using local CPU-optimized ONNX models (fastembed) and compute cosine similarity for semantic search.",
            date=date.today(),
            primary_category_id=cat_ml.id
        ))

        logger.info("Seeding connections...")
        # 3. Create entry-to-category auto-connections (the router does this, but crud layer needs manual connection)
        crud.create_connection(session, ConnectionCreate(
            source_id=learn_react.id,
            target_id=cat_web.id,
            type="entry-category"
        ))
        
        crud.create_connection(session, ConnectionCreate(
            source_id=learn_fastapi.id,
            target_id=cat_web.id,
            type="entry-category"
        ))
        
        crud.create_connection(session, ConnectionCreate(
            source_id=learn_pandas.id,
            target_id=cat_data.id,
            type="entry-category"
        ))
        
        crud.create_connection(session, ConnectionCreate(
            source_id=learn_vector.id,
            target_id=cat_ml.id,
            type="entry-category"
        ))

        # 4. Cross connections
        # Text Embeddings -> NumPy & Pandas Data Analysis
        crud.create_connection(session, ConnectionCreate(
            source_id=learn_vector.id,
            target_id=learn_pandas.id,
            type="entry-entry"
        ))

        # FastAPI Routing -> Text Embeddings
        crud.create_connection(session, ConnectionCreate(
            source_id=learn_fastapi.id,
            target_id=learn_vector.id,
            type="entry-entry"
        ))

        # Category -> Category connection
        crud.create_connection(session, ConnectionCreate(
            source_id=cat_web.id,
            target_id=cat_ml.id,
            type="category-category"
        ))

        session.commit()
        logger.info("Seeding complete successfully!")

if __name__ == "__main__":
    seed_db()
