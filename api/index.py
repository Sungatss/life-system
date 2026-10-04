import sys
import os

# Add root directory to path so 'backend' package can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app

# Ensure tables exist on cold start in serverless environment
from backend.app.database import engine, Base
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[api/index.py] Table creation check: {e}")
