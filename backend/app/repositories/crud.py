from sqlmodel import Session, select
from app.models.models import Category, LearningEntry, Connection, CategoryCreate, LearningEntryCreate, ConnectionCreate
from uuid import UUID
from typing import List, Optional
from datetime import datetime
import json
from app.core.embeddings import get_embedding

# Category CRUD
def create_category(db: Session, category: CategoryCreate) -> Category:
    db_cat = Category.model_validate(category)
    # Generate and save embedding
    text_to_embed = f"{category.name} {category.description or ''}"
    db_cat.embedding = json.dumps(get_embedding(text_to_embed))
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
    # Generate and save embedding
    text_to_embed = f"{learning.title} {learning.content}"
    db_learn.embedding = json.dumps(get_embedding(text_to_embed))
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
    # Regenerate and save embedding
    text_to_embed = f"{title} {content}"
    db_learn.embedding = json.dumps(get_embedding(text_to_embed))
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


def rebuild_all_embeddings(db: Session) -> int:
    """Regenerates embeddings for all database entries that are missing them."""
    count = 0
    # Reindex categories
    categories = db.exec(select(Category)).all()
    for cat in categories:
        if not cat.embedding:
            text = f"{cat.name} {cat.description or ''}"
            cat.embedding = json.dumps(get_embedding(text))
            db.add(cat)
            count += 1
            
    # Reindex learnings
    learnings = db.exec(select(LearningEntry)).all()
    for learn in learnings:
        if not learn.embedding:
            text = f"{learn.title} {learn.content}"
            learn.embedding = json.dumps(get_embedding(text))
            db.add(learn)
            count += 1
            
    if count > 0:
        db.commit()
    return count


def get_connected_nodes(db: Session, node_id: UUID) -> List[dict]:
    """Retrieves all categories and learnings connected to the specified node ID."""
    conns = db.exec(
        select(Connection).where(
            (Connection.source_id == node_id) | (Connection.target_id == node_id)
        )
    ).all()
    
    connected_nodes = []
    for conn in conns:
        other_id = conn.target_id if conn.source_id == node_id else conn.source_id
        
        # Check if other_id is a category
        cat = db.get(Category, other_id)
        if cat:
            connected_nodes.append({
                "connection_id": conn.id,
                "node_id": cat.id,
                "name": cat.name,
                "type": "category",
                "connection_type": conn.type
            })
            continue
            
        # Check if other_id is a learning entry
        learn = db.get(LearningEntry, other_id)
        if learn:
            connected_nodes.append({
                "connection_id": conn.id,
                "node_id": learn.id,
                "name": learn.title,
                "type": "entry",
                "connection_type": conn.type
            })
            
    return connected_nodes
