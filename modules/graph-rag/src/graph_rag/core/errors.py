class GraphRagError(Exception):
    def __init__(self, message: str, code: str = "invalid_input") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class GraphRagPermissionError(GraphRagError):
    def __init__(self, message: str = "You do not have permission to perform this action") -> None:
        super().__init__(message, "forbidden")
