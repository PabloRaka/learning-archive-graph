import os
import sys
from datetime import date
from typing import List, Optional
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP(
    "learning-archive-graph",
    host="0.0.0.0",
    port=int(os.environ.get("MCP_PORT", "8086"))
)

# Base API URL of the FastAPI backend (can be configured via environment variable)
API_URL = os.environ.get("API_URL", "http://localhost:8085/api")


def check_api_error(response: httpx.Response, action_desc: str):
    """Utility to raise explicit errors if the FastAPI backend returns an error status."""
    if response.status_code >= 400:
        detail = ""
        try:
            json_data = response.json()
            if isinstance(json_data, dict) and "detail" in json_data:
                detail = f": {json_data['detail']}"
        except Exception:
            detail = f": {response.text}"
        
        raise RuntimeError(
            f"Failed to {action_desc}. Backend returned HTTP {response.status_code}{detail}"
        )


@mcp.tool()
async def get_graph() -> dict:
    """
    Retrieve the entire knowledge graph, including all nodes (categories and learnings) and links (connections).
    This is extremely useful for visualizing the overall map of categories and learnings.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/graph")
            check_api_error(response, "fetch graph data")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def list_categories() -> List[dict]:
    """
    List all categories in the system, including their IDs, names, and descriptions.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/categories")
            check_api_error(response, "fetch categories")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def add_category(name: str, description: Optional[str] = None) -> dict:
    """
    Create a new learning category.
    
    Args:
        name: Unique name of the category (e.g. 'Web Development', 'Machine Learning').
        description: Optional explanation of what this category covers.
    """
    payload = {
        "name": name,
        "description": description
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{API_URL}/categories", json=payload)
            check_api_error(response, f"create category '{name}'")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def delete_category(category_id: str) -> str:
    """
    Delete a category by its UUID.
    
    Args:
        category_id: UUID of the category to delete.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{API_URL}/categories/{category_id}")
            check_api_error(response, f"delete category '{category_id}'")
            return f"Successfully deleted category {category_id}."
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def list_learnings() -> List[dict]:
    """
    List all learning entries, including their IDs, titles, content markdown, dates, and primary category IDs.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/learnings")
            check_api_error(response, "fetch learning entries")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def add_learning(
    title: str,
    content: str,
    primary_category_id: str,
    date_val: Optional[str] = None,
    connected_node_ids: Optional[List[str]] = None
) -> dict:
    """
    Create a new learning log entry and connect it to other nodes in the knowledge graph.
    
    Args:
        title: Title of the learning log.
        content: Markdown content describing the details of what was learned.
        primary_category_id: The UUID of the primary category this entry belongs to.
        date_val: Date of learning in YYYY-MM-DD format. Defaults to today's date if not provided.
        connected_node_ids: Optional list of UUIDs (categories or other entries) to establish links to.
    """
    if not date_val:
        date_val = date.today().isoformat()
        
    payload = {
        "title": title,
        "content": content,
        "date": date_val,
        "primary_category_id": primary_category_id,
        "connected_node_ids": connected_node_ids or []
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{API_URL}/learnings", json=payload)
            check_api_error(response, f"create learning entry '{title}'")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def update_learning(
    learning_id: str,
    title: str,
    content: str,
    primary_category_id: str,
    date_val: Optional[str] = None,
    connected_node_ids: Optional[List[str]] = None
) -> dict:
    """
    Update an existing learning log entry, including its content, primary category, and links.
    
    Args:
        learning_id: UUID of the learning entry to update.
        title: Updated title of the learning log.
        content: Updated markdown content details.
        primary_category_id: The UUID of the primary category this entry belongs to.
        date_val: Date of learning in YYYY-MM-DD format. Defaults to today's date if not provided.
        connected_node_ids: Optional list of UUIDs to connect to. This replaces all existing connections.
    """
    if not date_val:
        date_val = date.today().isoformat()

    payload = {
        "title": title,
        "content": content,
        "date": date_val,
        "primary_category_id": primary_category_id,
        "connected_node_ids": connected_node_ids or []
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.put(f"{API_URL}/learnings/{learning_id}", json=payload)
            check_api_error(response, f"update learning entry '{learning_id}'")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def delete_learning(learning_id: str) -> str:
    """
    Delete a learning log entry by its UUID.
    
    Args:
        learning_id: UUID of the learning entry to delete.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{API_URL}/learnings/{learning_id}")
            check_api_error(response, f"delete learning entry '{learning_id}'")
            return f"Successfully deleted learning entry {learning_id}."
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def list_connections() -> List[dict]:
    """
    List all active connections/links between nodes in the system.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/connections")
            check_api_error(response, "fetch connections")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def add_connection(
    source_id: str,
    target_id: str,
    connection_type: Optional[str] = "entry-entry"
) -> dict:
    """
    Establish a connection/link between two existing nodes (categories or learning entries).
    
    Args:
        source_id: UUID of the source node.
        target_id: UUID of the target node.
        connection_type: Type of connection. Options are: 'category-category', 'entry-category', 'entry-entry'. Defaults to 'entry-entry'.
    """
    payload = {
        "source_id": source_id,
        "target_id": target_id,
        "type": connection_type
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{API_URL}/connections", json=payload)
            check_api_error(response, f"create connection between {source_id} and {target_id}")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def delete_connection(connection_id: str) -> str:
    """
    Delete an existing connection/link by its UUID.
    
    Args:
        connection_id: UUID of the connection to delete.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{API_URL}/connections/{connection_id}")
            check_api_error(response, f"delete connection '{connection_id}'")
            return f"Successfully deleted connection {connection_id}."
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def semantic_search(query: str, limit: Optional[int] = 5) -> List[dict]:
    """
    Perform a semantic search across categories and learning entries in the graph.
    Returns nodes sorted by their conceptual similarity to the query.
    
    Args:
        query: The search term or conceptual phrase (e.g. 'state management' or 'machine learning').
        limit: Max number of matches to return (defaults to 5).
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/search", params={"q": query, "limit": limit or 5})
            check_api_error(response, f"perform semantic search for '{query}'")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def get_learning(learning_id: str) -> dict:
    """
    Retrieve the full details of a specific learning entry by its UUID,
    including its title, content markdown, date, and primary category ID.
    
    Args:
        learning_id: UUID of the learning entry to retrieve.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/learnings/{learning_id}")
            check_api_error(response, f"fetch learning entry '{learning_id}'")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.tool()
async def get_category(category_id: str) -> dict:
    """
    Retrieve the details of a specific category by its UUID,
    including its name and description.
    
    Args:
        category_id: UUID of the category to retrieve.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/categories/{category_id}")
            check_api_error(response, f"fetch category '{category_id}'")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.prompt()
def prepare_new_topic(topic: str) -> str:
    """
    Guides the AI to lookup previous notes semantically, connect new concepts to existing ones,
    and suggest how to integrate the new topic into the knowledge graph.
    """
    return f"""
You are helping the user learn a new topic: "{topic}".
Before you explain this topic or suggest adding a new entry, you MUST lookup previous material to see what the user has already learned that is related to "{topic}".

Follow these steps step-by-step:
1. Call `semantic_search` with the query "{topic}" to find related categories or learning entries in the graph.
2. Review the search results. If you find highly relevant learning entries, call `get_learning` with their IDs to read their full contents.
3. Compare the new topic with existing knowledge:
   - Identify existing concepts they already know that can help explain the new topic.
   - Design a logical explanation that links the new topic to their previous learning (e.g. "Building on your notes about X...").
4. Formulate the explanation of "{topic}".
5. Propose a new learning entry structure (title, markdown content) and suggest which existing nodes (UUIDs) to connect it to, establishing links in the Knowledge Graph.
"""


@mcp.tool()
async def get_quiz_material(topic: Optional[str] = None, limit: int = 5) -> List[dict]:
    """
    Retrieve a bundle of learning entries and categories to use as reference material for generating a quiz.
    If a topic is provided, it uses semantic search to find the most relevant notes.
    If no topic is provided, it returns the most recent learning entries.
    
    Args:
        topic: Optional topic name or concept to generate a quiz on.
        limit: Max number of notes to retrieve.
    """
    async with httpx.AsyncClient() as client:
        try:
            if topic and topic.strip():
                # Fetch relevant entries via semantic search
                search_res = await client.get(f"{API_URL}/search", params={"q": topic, "limit": limit})
                check_api_error(search_res, f"fetch search results for quiz on '{topic}'")
                nodes = search_res.json()
                
                materials = []
                for node in nodes:
                    if node["type"] == "entry":
                        detail_res = await client.get(f"{API_URL}/learnings/{node['id']}")
                        if detail_res.status_code == 200:
                            materials.append(detail_res.json())
                    elif node["type"] == "category":
                        detail_res = await client.get(f"{API_URL}/categories/{node['id']}")
                        if detail_res.status_code == 200:
                            materials.append(detail_res.json())
                return materials
            else:
                # Fetch recent learning entries
                learn_res = await client.get(f"{API_URL}/learnings")
                check_api_error(learn_res, "fetch learning entries for quiz")
                all_learnings = learn_res.json()
                # Sort by date descending
                all_learnings.sort(key=lambda x: x.get("date", ""), reverse=True)
                return all_learnings[:limit]
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.prompt()
def generate_quiz(topic: Optional[str] = None, num_questions: int = 3) -> str:
    """
    Generates an interactive multiple-choice quiz based on the user's studied notes.
    The AI will retrieve notes, ask questions, grade the answers, and reference original notes.
    
    Args:
        topic: Optional topic or category to test the user on (e.g. 'React' or 'Machine Learning').
        num_questions: Number of questions to generate (defaults to 3).
    """
    topic_str = f'"{topic}"' if topic else "your recent notes"
    return f"""
You are going to generate an interactive quiz to test the user's understanding of {topic_str}.
Follow these instructions step-by-step:

1. Call the `get_quiz_material` tool with topic="{topic or ''}" and limit=5 to retrieve the actual material the user has studied.
2. Based *only* on the retrieved material, construct a quiz with exactly {num_questions} multiple-choice questions.
   - For each question, provide 4 options (A, B, C, D).
   - Ensure the questions test actual understanding of the concepts in their notes.
   - Do NOT reveal the correct answers yet.
3. Present the quiz to the user and ask them to reply with their answers (e.g. "1. A, 2. B, 3. C").
4. Once the user replies:
   - Grade their answers.
   - For each question, explain why the correct option is right and why other options are wrong, explicitly quoting or referencing their original notes.
   - Give them a final score (e.g., 2/3).
"""


@mcp.tool()
async def get_generated_quiz(limit: Optional[int] = 3) -> dict:
    """
    Retrieve a programmatically generated multiple-choice quiz from the database.
    This generates questions checking category associations, content snippets, and graph links.
    
    Args:
        limit: Number of questions to generate (defaults to 3).
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{API_URL}/quiz/generate", params={"limit": limit or 3})
            check_api_error(response, "generate programmatic quiz")
            return response.json()
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


@mcp.prompt()
def solve_generated_quiz(num_questions: int = 3) -> str:
    """
    Directs the AI to fetch a dynamically generated quiz from the backend and solve it,
    explaining its reasoning for each answer to demonstrate its understanding of the user's graph.
    
    Args:
        num_questions: Number of questions to solve (defaults to 3).
    """
    return f"""
You are going to take a test about the user's knowledge graph to demonstrate your understanding of their study notes and concepts.

Follow these steps step-by-step:
1. Call the `get_generated_quiz` tool with limit={num_questions} to retrieve a programmatically generated multiple-choice test.
2. For each question in the test:
   - Carefully read the question and the options.
   - Explain your reasoning based on what you know or by searching the user's notes using tools if needed (e.g. `semantic_search` or `get_learning`).
   - Clearly state which option is the correct answer.
3. Present your completed answers in a clean format, including the correct answers side-by-side with your reasoning.
4. Calculate your own score against the `correct_answer` fields in the quiz payload and report your final score.
"""


@mcp.tool()
async def fetch_github_code(repo_url: str, file_path: str, branch: Optional[str] = "main") -> str:
    """
    Fetch a code file directly from a public GitHub repository.
    Returns the file content formatted in a Markdown code block,
    suitable to be inserted directly into a learning entry's content.
    
    Args:
        repo_url: URL or name of the GitHub repository (e.g. 'https://github.com/octocat/Hello-World' or 'octocat/Hello-World').
        file_path: Path to the file in the repository (e.g. 'src/utils.py').
        branch: Branch name (defaults to 'main').
    """
    payload = {
        "repo_url": repo_url,
        "file_path": file_path,
        "branch": branch or "main"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{API_URL}/code-fetch/github", json=payload)
            check_api_error(response, f"fetch code from GitHub repo '{repo_url}' path '{file_path}'")
            return response.json()["formatted_content"]
        except httpx.RequestError as e:
            raise RuntimeError(f"Failed to communicate with FastAPI backend: {e}")


if __name__ == "__main__":
    import os
    transport = os.environ.get("MCP_TRANSPORT", "stdio").lower()
    if transport == "sse":
        mcp.run(transport="sse")
    else:
        # FastMCP runs automatically on stdio when run directly
        mcp.run()
