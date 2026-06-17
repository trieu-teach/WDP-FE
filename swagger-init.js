
window.onload = function() {
  // Build a system
  var url = window.location.search.match(/url=([^&]+)/);
  if (url && url.length > 1) {
    url = decodeURIComponent(url[1]);
  } else {
    url = window.location.origin;
  }
  var options = {
  "swaggerDoc": {
    "openapi": "3.0.0",
    "info": {
      "title": "WDP Manga API",
      "version": "1.0.0",
      "description": "Webcomic Distribution Platform — Manga Management API"
    },
    "servers": [
      {
        "url": "https://wdp-be-a2qb.onrender.com",
        "description": "Production server"
      }
    ],
    "components": {
      "securitySchemes": {
        "BearerAuth": {
          "type": "http",
          "scheme": "bearer",
          "bearerFormat": "JWT"
        }
      },
      "schemas": {
        "Series": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "genre": {
              "type": "string"
            },
            "target_audience": {
              "type": "string"
            },
            "synopsis": {
              "type": "string"
            },
            "author_id": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "submitted",
                "approved",
                "rejected",
                "published",
                "cancelled"
              ]
            },
            "publication_schedule": {
              "type": "string",
              "enum": [
                "weekly",
                "monthly",
                "null"
              ]
            },
            "is_public": {
              "type": "boolean"
            },
            "average_score": {
              "type": "number"
            },
            "total_votes": {
              "type": "integer"
            },
            "cover_image_url": {
              "type": "string"
            },
            "eb_evaluation_id": {
              "type": "string",
              "nullable": true
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "Chapter": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "series_id": {
              "type": "string"
            },
            "chapter_number": {
              "type": "integer"
            },
            "title": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "pending_assistant",
                "pending_TE",
                "TE_revision",
                "pending_EB",
                "EB_revision",
                "published"
              ]
            },
            "submitted_by": {
              "type": "string"
            },
            "te_review_id": {
              "type": "string",
              "nullable": true
            },
            "eb_evaluation_id": {
              "type": "string",
              "nullable": true
            },
            "assistant_id": {
              "type": "string",
              "nullable": true
            },
            "revision_notes": {
              "type": "string"
            },
            "is_published": {
              "type": "boolean"
            },
            "published_at": {
              "type": "string",
              "format": "date-time",
              "nullable": true
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "Task": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "page_id": {
              "type": "string"
            },
            "chapter_id": {
              "type": "string"
            },
            "assigned_by": {
              "type": "string"
            },
            "assigned_to": {
              "type": "string"
            },
            "work_type": {
              "type": "string",
              "enum": [
                "background",
                "shading",
                "effects",
                "details",
                "other"
              ]
            },
            "region": {
              "type": "object",
              "properties": {
                "x": {
                  "type": "number"
                },
                "y": {
                  "type": "number"
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                }
              }
            },
            "description": {
              "type": "string"
            },
            "revision_note": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "pending",
                "in_progress",
                "submitted",
                "approved",
                "revision"
              ]
            },
            "result_image_url": {
              "type": "string"
            },
            "price": {
              "type": "number"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "Vote": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "series_id": {
              "type": "string"
            },
            "reader_id": {
              "type": "string"
            },
            "score": {
              "type": "integer",
              "minimum": 1,
              "maximum": 10
            },
            "comment": {
              "type": "string"
            },
            "release_period": {
              "type": "string"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "TEReview": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "chapter_id": {
              "type": "string"
            },
            "reviewed_by": {
              "type": "string"
            },
            "decision": {
              "type": "string",
              "enum": [
                "approved",
                "revision"
              ]
            },
            "annotations": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "_id": {
                    "type": "string"
                  },
                  "page_id": {
                    "type": "string"
                  },
                  "region": {
                    "type": "object",
                    "properties": {
                      "x": {
                        "type": "number"
                      },
                      "y": {
                        "type": "number"
                      },
                      "width": {
                        "type": "number"
                      },
                      "height": {
                        "type": "number"
                      }
                    }
                  },
                  "content": {
                    "type": "string"
                  },
                  "error_type": {
                    "type": "string",
                    "enum": [
                      "content",
                      "dialogue",
                      "script",
                      "art",
                      "other"
                    ]
                  }
                }
              }
            },
            "feedback": {
              "type": "string"
            },
            "revision_feedback": {
              "type": "string"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "EBEvaluation": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "series_id": {
              "type": "string"
            },
            "chapter_id": {
              "type": "string",
              "nullable": true
            },
            "evaluated_by": {
              "type": "string"
            },
            "first_review": {
              "type": "boolean"
            },
            "member_scores": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "member_name": {
                    "type": "string"
                  },
                  "content_script": {
                    "type": "number"
                  },
                  "art": {
                    "type": "number"
                  },
                  "characters": {
                    "type": "number"
                  },
                  "commercial_potential": {
                    "type": "number"
                  },
                  "publisher_fit": {
                    "type": "number"
                  },
                  "total_score": {
                    "type": "number"
                  },
                  "notes": {
                    "type": "string"
                  }
                }
              }
            },
            "quick_decision": {
              "type": "string",
              "enum": [
                "approved",
                "rejected",
                "revision",
                "null"
              ]
            },
            "quick_notes": {
              "type": "string"
            },
            "result": {
              "type": "string",
              "enum": [
                "approved",
                "rejected",
                "revision",
                "null"
              ]
            },
            "publication_schedule": {
              "type": "string",
              "enum": [
                "weekly",
                "monthly",
                "null"
              ]
            },
            "notes": {
              "type": "string"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        },
        "Notification": {
          "type": "object",
          "properties": {
            "_id": {
              "type": "string"
            },
            "user_id": {
              "type": "string"
            },
            "type": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "message": {
              "type": "string"
            },
            "is_read": {
              "type": "boolean"
            },
            "related_entity_type": {
              "type": "string",
              "enum": [
                "series",
                "chapter",
                "page",
                "task",
                "cooperation_request",
                "cooperation",
                "te_review",
                "eb_evaluation",
                "vote"
              ]
            },
            "related_entity_id": {
              "type": "string",
              "nullable": true
            },
            "meta": {
              "type": "object",
              "additionalProperties": true
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "updatedAt": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      }
    },
    "security": [
      {
        "BearerAuth": []
      }
    ],
    "paths": {
      "/te-reviews/pending": {
        "get": {
          "tags": [
            "TEReviews"
          ],
          "summary": "Get pending chapters for TE review",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "List of pending chapters",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Chapter"
                        }
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden - TE role required"
            }
          }
        }
      },
      "/te-reviews/chapter/{chapterId}/review": {
        "post": {
          "tags": [
            "TEReviews"
          ],
          "summary": "Submit TE review for a chapter",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "chapterId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "decision"
                  ],
                  "properties": {
                    "decision": {
                      "type": "string",
                      "enum": [
                        "approved",
                        "revision"
                      ]
                    },
                    "annotations": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    },
                    "feedback": {
                      "type": "string"
                    },
                    "revision_feedback": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Review submitted successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object",
                        "properties": {
                          "chapter": {
                            "$ref": "#/components/schemas/Chapter"
                          },
                          "review": {
                            "$ref": "#/components/schemas/TEReview"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Invalid decision value"
            },
            "404": {
              "description": "Chapter not found or not pending TE review"
            }
          }
        }
      },
      "/te-reviews/chapter/{chapterId}": {
        "get": {
          "tags": [
            "TEReviews"
          ],
          "summary": "Get TE review for a chapter",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "chapterId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "responses": {
            "200": {
              "description": "TE review data",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/TEReview"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Review not found"
            }
          }
        }
      },
      "/tasks": {
        "post": {
          "summary": "Tạo task mới (Mangaka giao việc cho Assistant)",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "page_id",
                    "assigned_to",
                    "work_type",
                    "region"
                  ],
                  "properties": {
                    "page_id": {
                      "type": "string",
                      "description": "ID của trang cần giao việc"
                    },
                    "assigned_to": {
                      "type": "string",
                      "description": "ID của Assistant được giao việc"
                    },
                    "work_type": {
                      "type": "string"
                    },
                    "region": {
                      "type": "object",
                      "properties": {
                        "x": {
                          "type": "number"
                        },
                        "y": {
                          "type": "number"
                        },
                        "width": {
                          "type": "number"
                        },
                        "height": {
                          "type": "number"
                        }
                      }
                    },
                    "description": {
                      "type": "string",
                      "description": "Mô tả chi tiết công việc"
                    },
                    "price": {
                      "type": "number",
                      "description": "Giá tiền cho công việc"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Task được tạo thành công"
            },
            "400": {
              "description": "Thiếu thông tin bắt buộc"
            },
            "403": {
              "description": "Assistant chưa ký hợp đồng hợp tác"
            },
            "404": {
              "description": "Page hoặc Chapter không tìm thấy"
            }
          }
        }
      },
      "/tasks/my-assignments": {
        "get": {
          "summary": "Lấy danh sách công việc được giao (Assistant)",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "status",
              "schema": {
                "type": "string"
              },
              "description": "Filter by status"
            },
            {
              "in": "query",
              "name": "chapter_id",
              "schema": {
                "type": "string"
              },
              "description": "Filter by chapter ID"
            },
            {
              "in": "query",
              "name": "page",
              "schema": {
                "type": "integer",
                "default": 1
              }
            },
            {
              "in": "query",
              "name": "limit",
              "schema": {
                "type": "integer",
                "default": 20
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách công việc",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Task"
                        }
                      },
                      "pagination": {
                        "type": "object",
                        "properties": {
                          "total": {
                            "type": "integer"
                          },
                          "page": {
                            "type": "integer"
                          },
                          "limit": {
                            "type": "integer"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/tasks/chapter/{chapterId}": {
        "get": {
          "summary": "Lấy tất cả tasks trong một chapter (Mangaka)",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "chapterId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của chapter"
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách tasks trong chapter",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Task"
                        }
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Chapter không tìm thấy hoặc không có quyền truy cập"
            }
          }
        }
      },
      "/tasks/{id}/start": {
        "patch": {
          "summary": "Assistant bắt đầu làm task",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của task"
            }
          ],
          "responses": {
            "200": {
              "description": "Task đã bắt đầu",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Task"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Task không thể bắt đầu với trạng thái hiện tại"
            },
            "404": {
              "description": "Task không tìm thấy"
            }
          }
        }
      },
      "/tasks/{id}/submit": {
        "post": {
          "summary": "Assistant nộp kết quả công việc",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của task"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "multipart/form-data": {
                "schema": {
                  "type": "object",
                  "required": [
                    "result_image"
                  ],
                  "properties": {
                    "result_image": {
                      "type": "string",
                      "format": "binary",
                      "description": "File ảnh kết quả công việc"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Task đã được nộp thành công",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Task"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Task phải đang in_progress và cần upload ảnh"
            },
            "404": {
              "description": "Task không tìm thấy"
            }
          }
        }
      },
      "/tasks/{id}/approve": {
        "patch": {
          "summary": "Mangaka duyệt task",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của task"
            }
          ],
          "responses": {
            "200": {
              "description": "Task đã được duyệt",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Task"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Task phải đang ở trạng thái submitted"
            },
            "404": {
              "description": "Task không tìm thấy"
            }
          }
        }
      },
      "/tasks/{id}/revision": {
        "patch": {
          "summary": "Mangaka yêu cầu chỉnh sửa task",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của task"
            }
          ],
          "requestBody": {
            "required": false,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "note": {
                      "type": "string",
                      "description": "Ghi chú yêu cầu chỉnh sửa"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Task đã được gửi vào revision",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Task"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Task phải đang ở trạng thái submitted"
            },
            "404": {
              "description": "Task không tìm thấy"
            }
          }
        }
      },
      "/tasks/stats": {
        "get": {
          "summary": "Lấy thống kê công việc và thu nhập (Assistant)",
          "tags": [
            "Tasks"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "year",
              "schema": {
                "type": "integer"
              },
              "description": "Year for stats (default current year)"
            },
            {
              "in": "query",
              "name": "month",
              "schema": {
                "type": "integer"
              },
              "description": "Month for stats (default current month)"
            }
          ],
          "responses": {
            "200": {
              "description": "Thống kê công việc",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object",
                        "properties": {
                          "approvedTasksThisMonth": {
                            "type": "integer",
                            "description": "Số task đã duyệt trong tháng"
                          },
                          "earningsThisMonth": {
                            "type": "number",
                            "description": "Thu nhập trong tháng"
                          },
                          "totalApprovedTasks": {
                            "type": "integer",
                            "description": "Tổng số task đã duyệt"
                          },
                          "totalEarnings": {
                            "type": "number",
                            "description": "Tổng thu nhập"
                          },
                          "period": {
                            "type": "string",
                            "description": "Tháng/năm thống kê (YYYY-MM)"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/submissions/chapters/{chapterId}/submit-to-te": {
        "post": {
          "summary": "Submit chapter to TE for review",
          "tags": [
            "Submissions"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "chapterId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "The chapter ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Chapter submitted successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean",
                        "example": true
                      },
                      "message": {
                        "type": "string",
                        "example": "Chapter đã được gửi cho TE duyệt"
                      },
                      "data": {
                        "type": "object",
                        "description": "The updated chapter object"
                      },
                      "seriesName": {
                        "type": "string",
                        "description": "Name of the series"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Chapter cannot be submitted in current status or unfinished tasks"
            },
            "404": {
              "description": "Chapter not found or unauthorized"
            }
          }
        }
      },
      "/submissions/mangaka": {
        "get": {
          "summary": "Get all chapters submitted by mangaka",
          "tags": [
            "Submissions"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "status",
              "required": false,
              "schema": {
                "type": "string"
              },
              "description": "Filter by chapter status (optional)"
            }
          ],
          "responses": {
            "200": {
              "description": "List of chapters",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean",
                        "example": true
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "series_id": {
                              "type": "object",
                              "properties": {
                                "name": {
                                  "type": "string"
                                },
                                "status": {
                                  "type": "string"
                                }
                              }
                            },
                            "status": {
                              "type": "string"
                            },
                            "createdAt": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/submissions/te": {
        "get": {
          "summary": "Get all chapters pending TE review",
          "tags": [
            "Submissions"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "List of chapters pending TE review",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean",
                        "example": true
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "submitted_by": {
                              "type": "object",
                              "properties": {
                                "username": {
                                  "type": "string"
                                },
                                "full_name": {
                                  "type": "string"
                                }
                              }
                            },
                            "series_id": {
                              "type": "object",
                              "properties": {
                                "name": {
                                  "type": "string"
                                }
                              }
                            },
                            "status": {
                              "type": "string"
                            },
                            "updatedAt": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/submissions/eb": {
        "get": {
          "summary": "Get all chapters pending EB review",
          "tags": [
            "Submissions"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "List of chapters pending EB review",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean",
                        "example": true
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "submitted_by": {
                              "type": "object",
                              "properties": {
                                "username": {
                                  "type": "string"
                                },
                                "full_name": {
                                  "type": "string"
                                }
                              }
                            },
                            "series_id": {
                              "type": "object",
                              "properties": {
                                "name": {
                                  "type": "string"
                                }
                              }
                            },
                            "status": {
                              "type": "string"
                            },
                            "updatedAt": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/series": {
        "get": {
          "summary": "Get all series (filtered by user role)",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "genre",
              "schema": {
                "type": "string"
              },
              "description": "Filter by genre"
            },
            {
              "in": "query",
              "name": "status",
              "schema": {
                "type": "string"
              },
              "description": "Filter by status (draft, published, etc.)"
            },
            {
              "in": "query",
              "name": "sort",
              "schema": {
                "type": "string",
                "default": "createdAt"
              },
              "description": "Sort field (average_score, createdAt)"
            },
            {
              "in": "query",
              "name": "order",
              "schema": {
                "type": "string",
                "enum": [
                  "asc",
                  "desc"
                ],
                "default": "desc"
              },
              "description": "Sort order"
            },
            {
              "in": "query",
              "name": "page",
              "schema": {
                "type": "integer",
                "default": 1
              },
              "description": "Page number"
            },
            {
              "in": "query",
              "name": "limit",
              "schema": {
                "type": "integer",
                "default": 20
              },
              "description": "Items per page"
            }
          ],
          "requestBody": {
            "required": false
          },
          "responses": {
            "200": {
              "description": "List of series",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object"
                        }
                      },
                      "pagination": {
                        "type": "object",
                        "properties": {
                          "total": {
                            "type": "integer"
                          },
                          "page": {
                            "type": "integer"
                          },
                          "limit": {
                            "type": "integer"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request"
            },
            "401": {
              "description": "Unauthorized"
            }
          }
        },
        "post": {
          "summary": "Create a new series (Mangaka only)",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "multipart/form-data": {
                "schema": {
                  "type": "object",
                  "required": [
                    "name"
                  ],
                  "properties": {
                    "name": {
                      "type": "string",
                      "description": "Series name"
                    },
                    "description": {
                      "type": "string",
                      "description": "Series description"
                    },
                    "genre": {
                      "type": "string",
                      "description": "Series genre"
                    },
                    "target_audience": {
                      "type": "string",
                      "description": "Target audience"
                    },
                    "synopsis": {
                      "type": "string",
                      "description": "Series synopsis"
                    },
                    "cover": {
                      "type": "string",
                      "format": "binary",
                      "description": "Cover image file"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Series created successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - Missing required fields"
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden - Mangaka role required"
            }
          }
        }
      },
      "/series/ranking": {
        "get": {
          "summary": "Get series ranking (top 50 published series)",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "period",
              "schema": {
                "type": "string"
              },
              "description": "Filter by release period"
            }
          ],
          "requestBody": {
            "required": false
          },
          "responses": {
            "200": {
              "description": "Ranked list of series",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object"
                        }
                      },
                      "warnings": {
                        "type": "array",
                        "description": "Mangaka warnings for low-ranked series",
                        "items": {
                          "type": "object",
                          "properties": {
                            "series_id": {
                              "type": "string"
                            },
                            "series_name": {
                              "type": "string"
                            },
                            "rank": {
                              "type": "integer"
                            },
                            "average_score": {
                              "type": "number"
                            },
                            "message": {
                              "type": "string"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request"
            },
            "401": {
              "description": "Unauthorized"
            }
          }
        }
      },
      "/series/mine": {
        "get": {
          "summary": "Get current Mangaka's series",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [],
          "requestBody": {
            "required": false
          },
          "responses": {
            "200": {
              "description": "List of series owned by current Mangaka",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object"
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Mangaka role required"
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden"
            }
          }
        }
      },
      "/series/{id}": {
        "get": {
          "summary": "Get series details by ID",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "requestBody": {
            "required": false
          },
          "responses": {
            "200": {
              "description": "Series details",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request"
            },
            "401": {
              "description": "Unauthorized"
            },
            "404": {
              "description": "Series not found"
            }
          }
        },
        "patch": {
          "summary": "Update series details (Mangaka only)",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string",
                      "description": "Series name"
                    },
                    "description": {
                      "type": "string",
                      "description": "Series description"
                    },
                    "genre": {
                      "type": "string",
                      "description": "Series genre"
                    },
                    "target_audience": {
                      "type": "string",
                      "description": "Target audience"
                    },
                    "synopsis": {
                      "type": "string",
                      "description": "Series synopsis"
                    },
                    "cover_image_url": {
                      "type": "string",
                      "description": "Cover image URL"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Series updated successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request"
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden - Not the series owner"
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/series/{id}/cover": {
        "post": {
          "summary": "Upload series cover image",
          "tags": [
            "Series"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "multipart/form-data": {
                "schema": {
                  "type": "object",
                  "required": [
                    "cover"
                  ],
                  "properties": {
                    "cover": {
                      "type": "string",
                      "format": "binary",
                      "description": "Cover image file"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Cover image uploaded successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "message": {
                        "type": "string"
                      },
                      "data": {
                        "type": "object",
                        "properties": {
                          "cover_image_url": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request - No image uploaded or invalid file"
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden - Not the series owner"
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/series/{id}/chapters": {
        "get": {
          "summary": "Get chapters for a series",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "requestBody": {
            "required": false
          },
          "responses": {
            "200": {
              "description": "List of chapters",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object"
                        }
                      },
                      "seriesName": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request"
            },
            "401": {
              "description": "Unauthorized"
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/reader/series": {
        "get": {
          "tags": [
            "Readers"
          ],
          "summary": "Get published series for readers",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "genre",
              "schema": {
                "type": "string"
              }
            },
            {
              "in": "query",
              "name": "sort",
              "schema": {
                "type": "string",
                "default": "average_score"
              }
            },
            {
              "in": "query",
              "name": "page",
              "schema": {
                "type": "integer",
                "default": 1
              }
            },
            {
              "in": "query",
              "name": "limit",
              "schema": {
                "type": "integer",
                "default": 20
              }
            }
          ],
          "responses": {
            "200": {
              "description": "List of published series",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Series"
                        }
                      },
                      "pagination": {
                        "type": "object",
                        "properties": {
                          "total": {
                            "type": "integer"
                          },
                          "page": {
                            "type": "integer"
                          },
                          "limit": {
                            "type": "integer"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden - Reader role required"
            }
          }
        }
      },
      "/reader/series/{id}": {
        "get": {
          "tags": [
            "Readers"
          ],
          "summary": "Get series details for a reader",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Series details",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Series"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/reader/series/{id}/chapters": {
        "get": {
          "tags": [
            "Readers"
          ],
          "summary": "Get published chapters for a series",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "responses": {
            "200": {
              "description": "List of published chapters",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Chapter"
                        }
                      },
                      "seriesName": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/reader/chapters/{id}": {
        "get": {
          "tags": [
            "Readers"
          ],
          "summary": "Get chapter details for a reader",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Chapter details",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Chapter"
                      },
                      "seriesName": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Chapter not found"
            }
          }
        }
      },
      "/reader/votes": {
        "post": {
          "tags": [
            "Readers"
          ],
          "summary": "Submit a vote for a series",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "series_id",
                    "score"
                  ],
                  "properties": {
                    "series_id": {
                      "type": "string"
                    },
                    "score": {
                      "type": "number",
                      "minimum": 1,
                      "maximum": 10
                    },
                    "comment": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Vote submitted successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Vote"
                      },
                      "seriesStats": {
                        "type": "object",
                        "properties": {
                          "average_score": {
                            "type": "number"
                          },
                          "total_votes": {
                            "type": "integer"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Validation error"
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/reader/votes/mine": {
        "get": {
          "tags": [
            "Readers"
          ],
          "summary": "Get current user's votes",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "series_id",
              "schema": {
                "type": "string"
              },
              "description": "Filter by series ID (optional)"
            }
          ],
          "responses": {
            "200": {
              "description": "User's votes",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Vote"
                        }
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized"
            }
          }
        }
      },
      "/notifications": {
        "get": {
          "tags": [
            "Notifications"
          ],
          "summary": "Get notifications for the authenticated user",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "page",
              "schema": {
                "type": "integer",
                "default": 1
              }
            },
            {
              "in": "query",
              "name": "limit",
              "schema": {
                "type": "integer",
                "default": 20
              }
            },
            {
              "in": "query",
              "name": "is_read",
              "schema": {
                "type": "string",
                "enum": [
                  true,
                  false
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Notifications list with pagination",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Notification"
                        }
                      },
                      "pagination": {
                        "type": "object",
                        "properties": {
                          "total": {
                            "type": "integer"
                          },
                          "page": {
                            "type": "integer"
                          },
                          "limit": {
                            "type": "integer"
                          },
                          "pages": {
                            "type": "integer"
                          }
                        }
                      },
                      "unreadCount": {
                        "type": "integer"
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized"
            }
          }
        }
      },
      "/notifications/{id}/read": {
        "patch": {
          "tags": [
            "Notifications"
          ],
          "summary": "Mark a notification as read",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Notification ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Notification marked as read",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Notification"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Notification not found"
            }
          }
        }
      },
      "/notifications/read-all": {
        "patch": {
          "tags": [
            "Notifications"
          ],
          "summary": "Mark all notifications as read",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "All notifications marked as read",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "message": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized"
            }
          }
        }
      },
      "/notifications/{id}": {
        "delete": {
          "tags": [
            "Notifications"
          ],
          "summary": "Delete a notification",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Notification ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Notification deleted",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "message": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Notification not found"
            }
          }
        }
      },
      "/eb-evaluations/pending": {
        "get": {
          "tags": [
            "EBEvaluations"
          ],
          "summary": "Get pending chapters for EB evaluation",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "List of pending chapters",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/Chapter"
                        }
                      }
                    }
                  }
                }
              }
            },
            "401": {
              "description": "Unauthorized"
            },
            "403": {
              "description": "Forbidden - EB role required"
            }
          }
        }
      },
      "/eb-evaluations/series/{seriesId}/evaluate": {
        "post": {
          "tags": [
            "EBEvaluations"
          ],
          "summary": "EB evaluates a series (first review or quick review)",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "seriesId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "member_scores": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "content_script": {
                            "type": "number"
                          },
                          "art": {
                            "type": "number"
                          },
                          "characters": {
                            "type": "number"
                          },
                          "commercial_potential": {
                            "type": "number"
                          },
                          "publisher_fit": {
                            "type": "number"
                          }
                        }
                      }
                    },
                    "result": {
                      "type": "string",
                      "enum": [
                        "approved",
                        "revision",
                        "rejected"
                      ]
                    },
                    "publication_schedule": {
                      "type": "string"
                    },
                    "notes": {
                      "type": "string"
                    },
                    "quick_decision": {
                      "type": "string",
                      "enum": [
                        "approved",
                        "revision",
                        "rejected"
                      ]
                    },
                    "quick_notes": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Evaluation submitted successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object",
                        "properties": {
                          "series": {
                            "$ref": "#/components/schemas/Series"
                          },
                          "evaluation": {
                            "$ref": "#/components/schemas/EBEvaluation"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Validation error"
            },
            "404": {
              "description": "Series not found"
            }
          }
        }
      },
      "/eb-evaluations/chapter/{chapterId}/evaluate": {
        "post": {
          "tags": [
            "EBEvaluations"
          ],
          "summary": "EB evaluates a chapter",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "chapterId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "member_scores": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    },
                    "result": {
                      "type": "string",
                      "enum": [
                        "approved",
                        "revision",
                        "rejected"
                      ]
                    },
                    "notes": {
                      "type": "string"
                    },
                    "quick_decision": {
                      "type": "string",
                      "enum": [
                        "approved",
                        "revision",
                        "rejected"
                      ]
                    },
                    "quick_notes": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Chapter evaluation submitted",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object",
                        "properties": {
                          "chapter": {
                            "$ref": "#/components/schemas/Chapter"
                          },
                          "evaluation": {
                            "$ref": "#/components/schemas/EBEvaluation"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Chapter not found or not pending EB"
            }
          }
        }
      },
      "/eb-evaluations/series/{seriesId}": {
        "get": {
          "tags": [
            "EBEvaluations"
          ],
          "summary": "Get evaluation history for a series",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "seriesId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Evaluation history",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "$ref": "#/components/schemas/EBEvaluation"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/eb-evaluations/series/{seriesId}/decision": {
        "patch": {
          "tags": [
            "EBEvaluations"
          ],
          "summary": "EB makes decision on an approved series",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "seriesId",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Series ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "decision"
                  ],
                  "properties": {
                    "decision": {
                      "type": "string",
                      "enum": [
                        "continue",
                        "cancelled",
                        "change_schedule"
                      ]
                    },
                    "schedule": {
                      "type": "string",
                      "description": "Required when decision is change_schedule"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Decision updated successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "$ref": "#/components/schemas/Series"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "decision is required"
            },
            "404": {
              "description": "Series not found or not approved"
            }
          }
        }
      },
      "/eb-evaluations/votes/confirm": {
        "post": {
          "tags": [
            "EBEvaluations"
          ],
          "summary": "EB confirms/updates reader votes for a series",
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "series_id",
                    "release_period",
                    "votes"
                  ],
                  "properties": {
                    "series_id": {
                      "type": "string"
                    },
                    "release_period": {
                      "type": "string"
                    },
                    "votes": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "reader_id": {
                            "type": "string"
                          },
                          "score": {
                            "type": "number"
                          },
                          "comment": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Votes confirmed successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "series_id, release_period, votes are required"
            }
          }
        }
      },
      "/cooperation-requests/requests": {
        "post": {
          "summary": "Gửi yêu cầu hợp tác",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "assistant_id"
                  ],
                  "properties": {
                    "assistant_id": {
                      "type": "string",
                      "description": "ID của Assistant"
                    },
                    "series_id": {
                      "type": "string",
                      "description": "ID của Series (tùy chọn)"
                    },
                    "message": {
                      "type": "string",
                      "description": "Tin nhắn đính kèm (tùy chọn)"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Yêu cầu hợp tác đã được gửi"
            },
            "400": {
              "description": "Thiếu assistant_id"
            },
            "404": {
              "description": "Assistant không tìm thấy"
            },
            "409": {
              "description": "Yêu cầu đang chờ xử lý"
            }
          }
        }
      },
      "/cooperation-requests/requests/mine": {
        "get": {
          "summary": "Lấy danh sách yêu cầu hợp tác đã gửi",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách yêu cầu hợp tác",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "assistant_id": {
                              "type": "object"
                            },
                            "series_id": {
                              "type": "object"
                            },
                            "status": {
                              "type": "string"
                            },
                            "message": {
                              "type": "string"
                            },
                            "createdAt": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/cooperation-requests/requests/incoming": {
        "get": {
          "summary": "Lấy danh sách yêu cầu hợp tác nhận được",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách yêu cầu nhận được",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "mangaka_id": {
                              "type": "object"
                            },
                            "series_id": {
                              "type": "object"
                            },
                            "status": {
                              "type": "string"
                            },
                            "message": {
                              "type": "string"
                            },
                            "createdAt": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/cooperation-requests/requests/{id}/accept-meet": {
        "post": {
          "summary": "Đồng ý gặp mặt với Mangaka",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của yêu cầu hợp tác"
            }
          ],
          "responses": {
            "200": {
              "description": "Đã đồng ý gặp mặt",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Yêu cầu không tìm thấy"
            }
          }
        }
      },
      "/cooperation-requests/requests/{id}/reject": {
        "post": {
          "summary": "Từ chối yêu cầu hợp tác",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của yêu cầu hợp tác"
            }
          ],
          "responses": {
            "200": {
              "description": "Đã từ chối yêu cầu",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Yêu cầu không tìm thấy"
            }
          }
        }
      },
      "/cooperation-requests/requests/{id}/accept-cooperation": {
        "post": {
          "summary": "Chấp nhận hợp tác sau khi gặp mặt",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của yêu cầu hợp tác"
            }
          ],
          "responses": {
            "200": {
              "description": "Đã chấp nhận hợp tác",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object",
                        "properties": {
                          "request": {
                            "type": "object"
                          },
                          "cooperation": {
                            "type": "object"
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Yêu cầu không tìm thấy hoặc chưa ở trạng thái gặp mặt"
            }
          }
        }
      },
      "/cooperation-requests/requests/{id}/decline-cooperation": {
        "post": {
          "summary": "Từ chối hợp tác sau khi gặp mặt",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "ID của yêu cầu hợp tác"
            }
          ],
          "responses": {
            "200": {
              "description": "Đã từ chối hợp tác",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "object"
                      }
                    }
                  }
                }
              }
            },
            "404": {
              "description": "Yêu cầu không tìm thấy hoặc chưa ở trạng thái gặp mặt"
            }
          }
        }
      },
      "/cooperation-requests/mine": {
        "get": {
          "summary": "Lấy danh sách hợp tác của Mangaka",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách hợp tác",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "assistant_id": {
                              "type": "object"
                            },
                            "series_id": {
                              "type": "object"
                            },
                            "agreed_at": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/cooperation-requests/assistant/mine": {
        "get": {
          "summary": "Lấy danh sách hợp tác của Assistant",
          "tags": [
            "Cooperations"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách hợp tác",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": {
                        "type": "boolean"
                      },
                      "data": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "_id": {
                              "type": "string"
                            },
                            "mangaka_id": {
                              "type": "object"
                            },
                            "series_id": {
                              "type": "object"
                            },
                            "agreed_at": {
                              "type": "string",
                              "format": "date-time"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/chapters": {
        "post": {
          "summary": "Tạo chapter mới",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "series_id",
                    "chapter_number"
                  ],
                  "properties": {
                    "series_id": {
                      "type": "string",
                      "description": "ID của series"
                    },
                    "chapter_number": {
                      "type": "integer",
                      "description": "Số thứ tự chapter"
                    },
                    "title": {
                      "type": "string",
                      "description": "Tiêu đề chapter (optional)"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Chapter được tạo thành công"
            },
            "400": {
              "description": "Thiếu series_id hoặc chapter_number"
            },
            "404": {
              "description": "Series not found hoặc unauthorized"
            },
            "409": {
              "description": "Chapter number đã tồn tại trong series"
            }
          }
        }
      },
      "/chapters/{id}": {
        "get": {
          "summary": "Lấy chi tiết chapter",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Chi tiết chapter kèm seriesName"
            },
            "404": {
              "description": "Chapter not found"
            }
          }
        },
        "patch": {
          "summary": "Cập nhật chapter",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "title": {
                      "type": "string",
                      "description": "Tiêu đề chapter"
                    },
                    "revision_notes": {
                      "type": "string",
                      "description": "Ghi chú sửa đổi"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Cập nhật thành công"
            },
            "400": {
              "description": "Không thể sửa chapter đã published"
            },
            "404": {
              "description": "Chapter not found hoặc unauthorized"
            }
          }
        }
      },
      "/chapters/{id}/pages": {
        "post": {
          "summary": "Upload pages cho chapter",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "multipart/form-data": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "images": {
                      "type": "array",
                      "items": {
                        "type": "string",
                        "format": "binary"
                      },
                      "description": "Các file ảnh (tối đa 50 ảnh)"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Upload thành công, trả về danh sách pages"
            },
            "400": {
              "description": "No images uploaded / Chapter not found"
            },
            "404": {
              "description": "Chapter not found hoặc unauthorized"
            }
          }
        },
        "get": {
          "summary": "Lấy danh sách pages của chapter",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách pages sắp xếp theo page_number"
            },
            "404": {
              "description": "Chapter not found"
            }
          }
        }
      },
      "/pages/{id}": {
        "get": {
          "summary": "Lấy chi tiết page kèm tasks",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Page ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Chi tiết page kèm danh sách tasks"
            },
            "404": {
              "description": "Page not found"
            }
          }
        }
      },
      "/chapters/{id}/assign": {
        "post": {
          "summary": "Gán 1 assistant cho cả chapter",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "assistant_id"
                  ],
                  "properties": {
                    "assistant_id": {
                      "type": "string",
                      "description": "Assistant user ID"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Gán thành công"
            },
            "400": {
              "description": "Thiếu assistant_id / Chapter đã có assistant"
            },
            "403": {
              "description": "Assistant chưa ký hợp đồng hợp tác"
            },
            "404": {
              "description": "Chapter not found"
            }
          }
        },
        "delete": {
          "summary": "Gỡ assistant khỏi chapter",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Chapter ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Gỡ thành công"
            },
            "400": {
              "description": "Chapter chưa có assistant"
            },
            "404": {
              "description": "Chapter not found"
            }
          }
        }
      },
      "/chapters/my-assignments": {
        "get": {
          "summary": "Lấy danh sách chapter được giao (Assistant)",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "query",
              "name": "status",
              "schema": {
                "type": "string"
              },
              "description": "Lọc theo chapter status (optional)"
            },
            {
              "in": "query",
              "name": "page",
              "schema": {
                "type": "integer",
                "default": 1
              }
            },
            {
              "in": "query",
              "name": "limit",
              "schema": {
                "type": "integer",
                "default": 20
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách chapter kèm số pages và tiến độ tasks"
            },
            "401": {
              "description": "Unauthorized"
            }
          }
        }
      },
      "/chapters/pages/{id}/notes": {
        "post": {
          "summary": "Gửi note cho page",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Page ID"
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "content"
                  ],
                  "properties": {
                    "content": {
                      "type": "string",
                      "description": "Nội dung note"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Note đã được tạo"
            }
          }
        },
        "get": {
          "summary": "Lấy danh sách note của page",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              },
              "description": "Page ID"
            }
          ],
          "responses": {
            "200": {
              "description": "Danh sách note"
            }
          }
        }
      },
      "/chapters/pages/{id}/notes/{noteId}": {
        "put": {
          "summary": "Chỉnh sửa note",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              }
            },
            {
              "in": "path",
              "name": "noteId",
              "required": true,
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "content"
                  ],
                  "properties": {
                    "content": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Note đã được cập nhật"
            }
          }
        },
        "delete": {
          "summary": "Xóa note",
          "tags": [
            "Chapters"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": {
                "type": "string"
              }
            },
            {
              "in": "path",
              "name": "noteId",
              "required": true,
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "Note đã được xóa"
            }
          }
        }
      },
      "/auth/register": {
        "post": {
          "summary": "Đăng ký tài khoản mới",
          "tags": [
            "Auth"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "username",
                    "password",
                    "full_name",
                    "email",
                    "role"
                  ],
                  "properties": {
                    "username": {
                      "type": "string"
                    },
                    "password": {
                      "type": "string"
                    },
                    "full_name": {
                      "type": "string"
                    },
                    "email": {
                      "type": "string"
                    },
                    "role": {
                      "type": "string",
                      "enum": [
                        "Mangaka",
                        "Assistant",
                        "Editor",
                        "EB",
                        "Reader"
                      ]
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Đăng ký thành công"
            },
            "409": {
              "description": "Username hoặc email đã tồn tại"
            }
          }
        }
      },
      "/auth/login": {
        "post": {
          "summary": "Đăng nhập",
          "tags": [
            "Auth"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "username",
                    "password"
                  ],
                  "properties": {
                    "username": {
                      "type": "string"
                    },
                    "password": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Đăng nhập thành công",
              "trả về JWT token": null
            },
            "401": {
              "description": "Sai username hoặc password"
            }
          }
        }
      },
      "/auth/me": {
        "get": {
          "summary": "Lấy thông tin user hiện tại",
          "tags": [
            "Auth"
          ],
          "security": [
            {
              "BearerAuth": []
            }
          ],
          "responses": {
            "200": {
              "description": "Thông tin user"
            },
            "404": {
              "description": "User not found"
            }
          }
        }
      }
    },
    "tags": []
  },
  "customOptions": {}
};
  url = options.swaggerUrl || url
  var urls = options.swaggerUrls
  var customOptions = options.customOptions
  var spec1 = options.swaggerDoc
  var swaggerOptions = {
    spec: spec1,
    url: url,
    urls: urls,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  }
  for (var attrname in customOptions) {
    swaggerOptions[attrname] = customOptions[attrname];
  }
  var ui = SwaggerUIBundle(swaggerOptions)

  if (customOptions.oauth) {
    ui.initOAuth(customOptions.oauth)
  }

  if (customOptions.preauthorizeApiKey) {
    const key = customOptions.preauthorizeApiKey.authDefinitionKey;
    const value = customOptions.preauthorizeApiKey.apiKeyValue;
    if (!!key && !!value) {
      const pid = setInterval(() => {
        const authorized = ui.preauthorizeApiKey(key, value);
        if(!!authorized) clearInterval(pid);
      }, 500)

    }
  }

  if (customOptions.authAction) {
    ui.authActions.authorize(customOptions.authAction)
  }

  window.ui = ui
}
