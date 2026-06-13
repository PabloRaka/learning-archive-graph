import os
import sys
from datetime import date
from typing import List, Optional
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP("learning-archive-graph")

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


if __name__ == "__main__":
    # FastMCP runs automatically on stdio when run directly
    mcp.run()
