from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from uuid import UUID
from typing import List, Optional
from datetime import date

from app.core.database import get_session
from app.models.models import (
    Category, CategoryCreate, CategoryRead,
    LearningEntry, LearningEntryRead,
    Connection, ConnectionCreate, ConnectionRead,
    GraphData, GraphNode, GraphLink
)
from app.repositories import crud

router = APIRouter()

# Schema for creating a learning entry with connections
from pydantic import BaseModel

class LearningCreateRequest(BaseModel):
    title: str
    content: str
    date: date
    primary_category_id: UUID
    connected_node_ids: Optional[List[UUID]] = []

class LearningUpdateRequest(BaseModel):
    title: str
    content: str
    date: date
    primary_category_id: UUID
    connected_node_ids: Optional[List[UUID]] = []

# --- Categories ---

@router.get("/categories", response_model=List[CategoryRead])
def read_categories(db: Session = Depends(get_session)):
    return crud.get_categories(db)

@router.post("/categories", response_model=CategoryRead)
def create_category(category: CategoryCreate, db: Session = Depends(get_session)):
    db_cat = crud.get_category_by_name(db, category.name)
    if db_cat:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    return crud.create_category(db, category)

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: UUID, db: Session = Depends(get_session)):
    success = crud.delete_category(db, category_id)
    if not success:
        raise HTTPException(status_code=404, detail="Category not found")
    return

# --- Learning Entries ---

@router.get("/learnings", response_model=List[LearningEntryRead])
def read_learnings(db: Session = Depends(get_session)):
    return crud.get_learnings(db)

@router.post("/learnings", response_model=LearningEntryRead)
def create_learning(payload: LearningCreateRequest, db: Session = Depends(get_session)):
    # Verify category exists
    cat = crud.get_category(db, payload.primary_category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Primary category not found")
    
    # 1. Create Learning Entry
    from app.models.models import LearningEntryCreate
    learn_create = LearningEntryCreate(
        title=payload.title,
        content=payload.content,
        date=payload.date,
        primary_category_id=payload.primary_category_id
    )
    db_learn = crud.create_learning(db, learn_create)
    
    # 2. Automatically link learning entry to its primary category
    crud.create_connection(db, ConnectionCreate(
        source_id=db_learn.id,
        target_id=payload.primary_category_id,
        type="entry-category"
    ))
    
    # 3. Create any other specified connections
    if payload.connected_node_ids:
        for target_id in payload.connected_node_ids:
            if target_id == payload.primary_category_id:
                continue  # already connected
            
            # Determine target node type to set connection type
            # Check if it's a category
            is_cat = crud.get_category(db, target_id) is not None
            conn_type = "entry-category" if is_cat else "entry-entry"
            
            crud.create_connection(db, ConnectionCreate(
                source_id=db_learn.id,
                target_id=target_id,
                type=conn_type
            ))
            
    return db_learn

@router.put("/learnings/{learning_id}", response_model=LearningEntryRead)
def update_learning(learning_id: UUID, payload: LearningUpdateRequest, db: Session = Depends(get_session)):
    # Verify category exists
    cat = crud.get_category(db, payload.primary_category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Primary category not found")
        
    db_learn = crud.update_learning(
        db, 
        learning_id, 
        title=payload.title, 
        content=payload.content, 
        date_val=payload.date, 
        primary_category_id=payload.primary_category_id
    )
    if not db_learn:
        raise HTTPException(status_code=404, detail="Learning entry not found")
        
    # Re-sync connections:
    # 1. Delete all connections from this node
    crud.delete_connections_by_node(db, learning_id)
    
    # 2. Re-add primary category connection
    crud.create_connection(db, ConnectionCreate(
        source_id=learning_id,
        target_id=payload.primary_category_id,
        type="entry-category"
    ))
    
    # 3. Re-add other connections
    if payload.connected_node_ids:
        for target_id in payload.connected_node_ids:
            if target_id == payload.primary_category_id:
                continue
            is_cat = crud.get_category(db, target_id) is not None
            conn_type = "entry-category" if is_cat else "entry-entry"
            crud.create_connection(db, ConnectionCreate(
                source_id=learning_id,
                target_id=target_id,
                type=conn_type
            ))
            
    return db_learn

@router.delete("/learnings/{learning_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_learning(learning_id: UUID, db: Session = Depends(get_session)):
    success = crud.delete_learning(db, learning_id)
    if not success:
        raise HTTPException(status_code=404, detail="Learning entry not found")
    return

# --- Connections ---

@router.get("/connections", response_model=List[ConnectionRead])
def read_connections(db: Session = Depends(get_session)):
    return crud.get_connections(db)

@router.post("/connections", response_model=ConnectionRead)
def create_connection(connection: ConnectionCreate, db: Session = Depends(get_session)):
    # Validate source and target exist
    src_is_cat = crud.get_category(db, connection.source_id) is not None
    src_is_learn = crud.get_learning(db, connection.source_id) is not None
    tgt_is_cat = crud.get_category(db, connection.target_id) is not None
    tgt_is_learn = crud.get_learning(db, connection.target_id) is not None
    
    if not (src_is_cat or src_is_learn):
        raise HTTPException(status_code=404, detail="Source node not found")
    if not (tgt_is_cat or tgt_is_learn):
        raise HTTPException(status_code=404, detail="Target node not found")
        
    return crud.create_connection(db, connection)

@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(connection_id: UUID, db: Session = Depends(get_session)):
    success = crud.delete_connection(db, connection_id)
    if not success:
        raise HTTPException(status_code=404, detail="Connection not found")
    return

# --- Graph Engine Endpoint ---

@router.get("/graph", response_model=GraphData)
def get_graph_data(db: Session = Depends(get_session)):
    categories = crud.get_categories(db)
    learnings = crud.get_learnings(db)
    connections = crud.get_connections(db)
    
    nodes = []
    # Index categories by id for quick lookup
    cat_map = {}
    for cat in categories:
        cat_map[cat.id] = cat.name
        nodes.append(GraphNode(
            id=cat.id,
            name=cat.name,
            type="category"
        ))
        
    for learn in learnings:
        nodes.append(GraphNode(
            id=learn.id,
            name=learn.title,
            type="entry",
            category_name=cat_map.get(learn.primary_category_id, "Unknown"),
            date=learn.date.isoformat()
        ))
        
    links = []
    for conn in connections:
        links.append(GraphLink(
            source=conn.source_id,
            target=conn.target_id,
            type=conn.type
        ))
        
    return GraphData(nodes=nodes, links=links)
