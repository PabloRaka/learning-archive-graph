from sqlmodel import Session, select
from app.models.models import Category, LearningEntry, Connection, CategoryCreate, LearningEntryCreate, ConnectionCreate
from uuid import UUID
from typing import List, Optional
from datetime import datetime

# Category CRUD
def create_category(db: Session, category: CategoryCreate) -> Category:
    db_cat = Category.model_validate(category)
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

def get_categories(db: Session) -> List[Category]:
    return db.exec(select(Category)).all()

def get_category(db: Session, category_id: UUID) -> Optional[Category]:
    return db.get(Category, category_id)

def get_category_by_name(db: Session, name: str) -> Optional[Category]:
    return db.exec(select(Category).where(Category.name == name)).first()

def delete_category(db: Session, category_id: UUID) -> bool:
    db_cat = db.get(Category, category_id)
    if not db_cat:
        return False
    
    # 1. Clean up connections involving this category
    delete_connections_by_node(db, category_id)
    
    # 2. Delete all learnings in this category and their connections
    learnings = db.exec(select(LearningEntry).where(LearningEntry.primary_category_id == category_id)).all()
    for learning in learnings:
        delete_learning(db, learning.id)
        
    db.delete(db_cat)
    db.commit()
    return True

# LearningEntry CRUD
def create_learning(db: Session, learning: LearningEntryCreate) -> LearningEntry:
    db_learn = LearningEntry.model_validate(learning)
    db.add(db_learn)
    db.commit()
    db.refresh(db_learn)
    return db_learn

def get_learnings(db: Session) -> List[LearningEntry]:
    return db.exec(select(LearningEntry)).all()

def get_learning(db: Session, learning_id: UUID) -> Optional[LearningEntry]:
    return db.get(LearningEntry, learning_id)

def update_learning(db: Session, learning_id: UUID, title: str, content: str, date_val, primary_category_id: UUID) -> Optional[LearningEntry]:
    db_learn = db.get(LearningEntry, learning_id)
    if not db_learn:
        return None
    db_learn.title = title
    db_learn.content = content
    db_learn.date = date_val
    db_learn.primary_category_id = primary_category_id
    db.add(db_learn)
    db.commit()
    db.refresh(db_learn)
    return db_learn

def delete_learning(db: Session, learning_id: UUID) -> bool:
    db_learn = db.get(LearningEntry, learning_id)
    if not db_learn:
        return False
    
    # Clean up connections involving this learning entry
    delete_connections_by_node(db, learning_id)
    db.delete(db_learn)
    db.commit()
    return True

# Connection CRUD
def create_connection(db: Session, connection: ConnectionCreate) -> Connection:
    # Prevent duplicate connections in either direction
    existing = db.exec(
        select(Connection).where(
            ((Connection.source_id == connection.source_id) & (Connection.target_id == connection.target_id)) |
            ((Connection.source_id == connection.target_id) & (Connection.target_id == connection.source_id))
        )
    ).first()
    if existing:
        return existing
        
    db_conn = Connection.model_validate(connection)
    db.add(db_conn)
    db.commit()
    db.refresh(db_conn)
    return db_conn

def get_connections(db: Session) -> List[Connection]:
    return db.exec(select(Connection)).all()

def delete_connection(db: Session, connection_id: UUID) -> bool:
    db_conn = db.get(Connection, connection_id)
    if not db_conn:
        return False
    db.delete(db_conn)
    db.commit()
    return True

def delete_connections_by_node(db: Session, node_id: UUID):
    conns = db.exec(
        select(Connection).where(
            (Connection.source_id == node_id) | (Connection.target_id == node_id)
        )
    ).all()
    for conn in conns:
        db.delete(conn)
    db.commit()
