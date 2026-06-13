import logging
from sqlmodel import create_engine, Session, SQLModel
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL
engine = None

# Fallback logic: Try PostgreSQL, fall back to SQLite
if db_url.startswith("postgresql") or db_url.startswith("postgres"):
    try:
        logger.info("Attempting to connect to PostgreSQL...")
        # 5-second timeout for quick fallback if PostgreSQL is down or unreachable
        engine = create_engine(db_url, connect_args={"connect_timeout": 5})
        # Test connection
        with engine.connect() as conn:
            logger.info("PostgreSQL connection successful.")
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed: {e}. Falling back to SQLite.")
        db_url = "sqlite:///./knowledge_graph.db"
        engine = None

if engine is None:
    logger.info("Initializing SQLite connection...")
    # SQLite check_same_thread is needed for FastAPI multithreaded requests
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)

def init_db():
    logger.info("Creating database tables if they do not exist...")
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
