from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from uuid import UUID
from typing import List, Optional
from datetime import date

from app.core.database import get_session
from app.models.models import (
    Category, CategoryCreate, CategoryRead, CategoryReadWithConnections,
    LearningEntry, LearningEntryRead, LearningEntryReadWithConnections,
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

@router.get("/categories/{category_id}", response_model=CategoryReadWithConnections)
def read_category(category_id: UUID, db: Session = Depends(get_session)):
    db_cat = crud.get_category(db, category_id)
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    connections = crud.get_connected_nodes(db, category_id)
    cat_data = db_cat.model_dump()
    cat_data["connections"] = connections
    return cat_data

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

@router.get("/learnings/{learning_id}", response_model=LearningEntryReadWithConnections)
def read_learning(learning_id: UUID, db: Session = Depends(get_session)):
    db_learn = crud.get_learning(db, learning_id)
    if not db_learn:
        raise HTTPException(status_code=404, detail="Learning entry not found")
    connections = crud.get_connected_nodes(db, learning_id)
    learn_data = db_learn.model_dump()
    learn_data["connections"] = connections
    return learn_data

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


# --- Semantic Search & Reindexing ---

@router.get("/search", response_model=List[GraphNode])
def semantic_search(q: str, limit: int = 5, db: Session = Depends(get_session)):
    if not q.strip():
        return []
        
    from app.core.embeddings import get_embedding, cosine_similarity
    import json
    
    query_vector = get_embedding(q)
    results = []
    
    # Fetch categories
    categories = crud.get_categories(db)
    # Fetch learnings
    learnings = crud.get_learnings(db)
    
    # We will find the category name map for learnings
    cat_map = {cat.id: cat.name for cat in categories}
    
    # Score categories
    for cat in categories:
        if cat.embedding:
            try:
                cat_vector = json.loads(cat.embedding)
                sim = cosine_similarity(query_vector, cat_vector)
                results.append((sim, GraphNode(
                    id=cat.id,
                    name=cat.name,
                    type="category",
                    similarity=sim
                )))
            except Exception:
                pass
                
    # Score learnings
    for learn in learnings:
        if learn.embedding:
            try:
                learn_vector = json.loads(learn.embedding)
                sim = cosine_similarity(query_vector, learn_vector)
                results.append((sim, GraphNode(
                    id=learn.id,
                    name=learn.title,
                    type="entry",
                    category_name=cat_map.get(learn.primary_category_id, "Unknown"),
                    date=learn.date.isoformat(),
                    similarity=sim
                )))
            except Exception:
                pass
                
    # Sort by similarity score descending
    results.sort(key=lambda x: x[0], reverse=True)
    
    # Take top N
    top_results = [item[1] for item in results[:limit]]
    return top_results


@router.post("/search/reindex")
def trigger_reindexing(db: Session = Depends(get_session)):
    try:
        count = crud.rebuild_all_embeddings(db)
        return {"status": "success", "message": f"Successfully reindexed {count} entries."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindexing failed: {str(e)}")


@router.get("/quiz/generate")
def generate_quiz_endpoint(limit: int = 3, db: Session = Depends(get_session)):
    import random
    categories = crud.get_categories(db)
    learnings = crud.get_learnings(db)
    connections = crud.get_connections(db)
    
    if not learnings:
        raise HTTPException(status_code=400, detail="Cannot generate quiz: No learning entries found in database.")
        
    questions = []
    
    fallback_categories = ["Cloud Computing", "DevOps", "Cybersecurity", "Mobile Development", "UI/UX Design", "Game Development"]
    fallback_titles = ["Introduction to Docker", "Git Version Control", "Rest API Design", "SQL Join Types", "CSS Grid Layout"]
    
    # 1. Category association question
    try:
        target_learn = random.choice(learnings)
        correct_cat = next((c for c in categories if c.id == target_learn.primary_category_id), None)
        correct_answer = correct_cat.name if correct_cat else "Unknown"
        
        options = {correct_answer}
        other_cats = [c.name for c in categories if c.name != correct_answer]
        random.shuffle(other_cats)
        for c_name in other_cats:
            if len(options) >= 4:
                break
            options.add(c_name)
        for fb in fallback_categories:
            if len(options) >= 4:
                break
            options.add(fb)
            
        options_list = list(options)
        random.shuffle(options_list)
        
        questions.append({
            "id": 1,
            "type": "category_association",
            "question": f"Which category does the learning entry '{target_learn.title}' belong to?",
            "options": options_list,
            "correct_answer": correct_answer
        })
    except Exception:
        pass

    # 2. Content snippet question
    try:
        target_learn = random.choice(learnings)
        content = target_learn.content
        snippet = content[:120] + "..." if len(content) > 120 else content
        correct_answer = target_learn.title
        
        options = {correct_answer}
        other_learns = [l.title for l in learnings if l.title != correct_answer]
        random.shuffle(other_learns)
        for title in other_learns:
            if len(options) >= 4:
                break
            options.add(title)
        for fb in fallback_titles:
            if len(options) >= 4:
                break
            options.add(fb)
            
        options_list = list(options)
        random.shuffle(options_list)
        
        questions.append({
            "id": 2,
            "type": "content_snippet",
            "question": f"Which learning entry matches the following content snippet?\n\"{snippet}\"",
            "options": options_list,
            "correct_answer": correct_answer
        })
    except Exception:
        pass

    # 3. Connection question
    try:
        connected_learnings = []
        for l in learnings:
            conns = [c for c in connections if c.source_id == l.id or c.target_id == l.id]
            if conns:
                connected_learnings.append(l)
                
        if connected_learnings:
            target_learn = random.choice(connected_learnings)
            conns = [c for c in connections if c.source_id == target_learn.id or c.target_id == target_learn.id]
            picked_conn = random.choice(conns)
            other_id = picked_conn.target_id if picked_conn.source_id == target_learn.id else picked_conn.source_id
            
            other_cat = next((c for c in categories if c.id == other_id), None)
            other_learn = next((l for l in learnings if l.id == other_id), None)
            correct_answer = other_cat.name if other_cat else (other_learn.title if other_learn else None)
            
            if correct_answer:
                options = {correct_answer}
                connected_ids = {c.target_id if c.source_id == target_learn.id else c.source_id for c in conns}
                connected_ids.add(target_learn.id)
                
                unconnected_names = []
                for c in categories:
                    if c.id not in connected_ids:
                        unconnected_names.append(c.name)
                for l in learnings:
                    if l.id not in connected_ids:
                        unconnected_names.append(l.title)
                        
                random.shuffle(unconnected_names)
                for name in unconnected_names:
                    if len(options) >= 4:
                        break
                    options.add(name)
                for fb in fallback_categories + fallback_titles:
                    if len(options) >= 4:
                        break
                    options.add(fb)
                    
                options_list = list(options)
                random.shuffle(options_list)
                
                questions.append({
                    "id": 3,
                    "type": "node_connection",
                    "question": f"Which of the following topics is directly connected (linked) to the entry '{target_learn.title}' in the knowledge graph?",
                    "options": options_list,
                    "correct_answer": correct_answer
                })
        else:
            target_learn = random.choice(learnings)
            correct_answer = target_learn.title
            options = {correct_answer}
            other_learns = [l.title for l in learnings if l.title != correct_answer]
            random.shuffle(other_learns)
            for title in other_learns:
                if len(options) >= 4:
                    break
                options.add(title)
            options_list = list(options)
            random.shuffle(options_list)
            
            questions.append({
                "id": 3,
                "type": "content_snippet_fallback",
                "question": f"Which learning entry describes the topic '{target_learn.title}'?",
                "options": options_list,
                "correct_answer": correct_answer
            })
    except Exception:
        pass
        
    return {"quiz_id": str(random.randint(1000, 9999)), "questions": questions[:limit]}


def parse_github_url(repo_url: str):
    """Parses owner and repository name from a GitHub URL or string format.
    Also strips trailing .git and handles full blob or raw URLs.
    """
    url = repo_url.strip()
    if url.startswith("https://"):
        url = url[8:]
    elif url.startswith("http://"):
        url = url[7:]
        
    if url.startswith("github.com/"):
        url = url[11:]
        
    url = url.strip("/")
    parts = url.split("/")
    if len(parts) >= 2:
        owner = parts[0]
        repo = parts[1]
        
        # Strip trailing .git
        if repo.endswith(".git"):
            repo = repo[:-4]
            
        parsed_branch = None
        parsed_path = None
        
        # Detect if it is a full file blob/raw URL
        if len(parts) > 3 and parts[2] in ("blob", "raw", "tree"):
            parsed_branch = parts[3]
            parsed_path = "/".join(parts[4:])
            
        return owner, repo, parsed_branch, parsed_path
        
    raise ValueError("Invalid GitHub repository format. Expected 'owner/repo' or 'https://github.com/owner/repo'")


class GitHubFetchRequest(BaseModel):
    repo_url: str
    file_path: str
    branch: Optional[str] = "main"


@router.post("/code-fetch/github")
def fetch_github_file(payload: GitHubFetchRequest):
    import httpx
    try:
        owner, repo, parsed_branch, parsed_path = parse_github_url(payload.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    branch = parsed_branch or payload.branch or "main"
    file_path = payload.file_path.strip("/") if payload.file_path else ""
    if not file_path:
        file_path = parsed_path or ""
        
    if not file_path:
        raise HTTPException(
            status_code=400, 
            detail="File path is empty. Please provide a file path or paste a direct file URL."
        )
    
    # Try fetching raw content
    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}"
    
    try:
        response = httpx.get(raw_url, follow_redirects=True)
        # Fallback to master if main branch 404s
        if response.status_code == 404 and branch == "main":
            fallback_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/{file_path}"
            response = httpx.get(fallback_url, follow_redirects=True)
            
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"Failed to fetch file from GitHub (HTTP {response.status_code})"
            )
            
        ext = file_path.split(".")[-1] if "." in file_path else ""
        formatted_content = f"### Fetched Code: `{file_path}`\n\n```{ext}\n{response.text}\n```\n"
        return {"content": response.text, "formatted_content": formatted_content}
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Error connecting to GitHub: {str(e)}")
