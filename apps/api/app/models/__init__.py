# Import all models here so SQLAlchemy's mapper registry is fully populated
# before any relationship resolution happens.
# Without this, string-based relationships like relationship("Ward") fail
# with InvalidRequestError when models are imported in isolation.
from app.models.base import Base, TimestampMixin  # noqa: F401
from app.models.ward import Ward                  # noqa: F401
from app.models.submission import Submission      # noqa: F401
from app.models.project import Project            # noqa: F401
from app.models.user import User                  # noqa: F401
from app.models.document import Document          # noqa: F401
