from datetime import date, datetime
from typing import Optional, List
from uuid import UUID, uuid4
from sqlmodel import Field, SQLModel, Relationship

class CategoryBase(SQLModel):
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None

class Category(CategoryBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    embedding: Optional[str] = Field(default=None, nullable=True)  # Store JSON list of float vectors

    # Relationships
    learnings: List["LearningEntry"] = Relationship(back_populates="primary_category")

class CategoryCreate(CategoryBase):
    pass

class CategoryRead(CategoryBase):
    id: UUID
    created_at: datetime

class ConnectedNodeInfo(SQLModel):
    connection_id: UUID
    node_id: UUID
    name: str
    type: str  # "category" or "entry"
    connection_type: str  # "category-category", "entry-category", "entry-entry"

class CategoryReadWithConnections(CategoryRead):
    connections: List[ConnectedNodeInfo] = []


class LearningEntryBase(SQLModel):
    title: str = Field(index=True)
    content: str  # Markdown text
    date: date
    primary_category_id: UUID = Field(foreign_key="category.id")

class LearningEntry(LearningEntryBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    embedding: Optional[str] = Field(default=None, nullable=True)  # Store JSON list of float vectors

    # Relationships
    primary_category: Optional[Category] = Relationship(back_populates="learnings")

class LearningEntryCreate(LearningEntryBase):
    pass

class LearningEntryRead(LearningEntryBase):
    id: UUID
    created_at: datetime

class LearningEntryReadWithConnections(LearningEntryRead):
    connections: List[ConnectedNodeInfo] = []


class ConnectionBase(SQLModel):
    source_id: UUID
    target_id: UUID
    type: str  # "category-category", "entry-category", "entry-entry"

class Connection(ConnectionBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ConnectionCreate(ConnectionBase):
    pass

class ConnectionRead(ConnectionBase):
    id: UUID
    created_at: datetime


# Aggregated Graph Model for D3 Frontend
class GraphNode(SQLModel):
    id: UUID
    name: str
    type: str  # "category" or "entry"
    category_name: Optional[str] = None
    date: Optional[str] = None
    similarity: Optional[float] = None

class GraphLink(SQLModel):
    source: UUID
    target: UUID
    type: str

class GraphData(SQLModel):
    nodes: List[GraphNode]
    links: List[GraphLink]
