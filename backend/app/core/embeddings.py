import json
from typing import List
import numpy as np

_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding
            # BAAI/bge-small-en-v1.5 is default, ~100MB download, extremely fast CPU execution
            _model = TextEmbedding()
        except Exception as e:
            print(f"Failed to initialize fastembed: {e}. Semantic search will run in fallback mode.")
            _model = False
    return _model

def get_embedding(text: str) -> List[float]:
    """Generates a 384-dimensional vector embedding for the given text."""
    if not text:
        return [0.0] * 384
        
    model = get_model()
    if model is False or model is None:
        # Fallback pseudo-embedding generator to ensure zero crashes
        import random
        random.seed(text)
        return [random.uniform(-0.1, 0.1) for _ in range(384)]
        
    try:
        # fastembed.embed takes a list of strings and returns a generator of numpy arrays
        embeddings = list(model.embed([text]))
        return embeddings[0].tolist()
    except Exception as e:
        print(f"Error during embedding generation: {e}")
        import random
        random.seed(text)
        return [random.uniform(-0.1, 0.1) for _ in range(384)]

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Computes the cosine similarity between two float vectors."""
    if not vec_a or not vec_b:
        return 0.0
    a = np.array(vec_a)
    b = np.array(vec_b)
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))
