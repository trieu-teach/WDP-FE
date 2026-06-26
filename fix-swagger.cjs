const fs = require('fs');
const path = 'd:\\WDP\\manga-wdp\\swagger-init.js';
let content = fs.readFileSync(path, 'utf8');

// Find the approve route and insert assign-te / remove-te before it
const approveRoute = `"/submissions/chapters/{chapterId}/approve": {
        "patch": {
          "tags": ["Submissions"],
          "summary": "Mangaka duyệt chapter sau khi tasks hoàn tất"`;

const assignTeBlock = `
      "/submissions/chapters/{chapterId}/assign-te": {
        "post": {
          "tags": ["Submissions"],
          "summary": "Gán TE cụ thể cho chapter (Mangaka chọn TE trước khi submit)",
          "security": [{ "BearerAuth": [] }],
          "parameters": [
            { "in": "path", "name": "chapterId", "required": true, "schema": { "type": "string" }, "description": "Chapter ID" }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["te_id"],
                  "properties": {
                    "te_id": {
                      "type": "string",
                      "nullable": true,
                      "description": "ObjectId của TE user. Để null để gỡ TE."
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "TE đã được gán",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": { "type": "boolean", "example": true },
                      "message": { "type": "string" },
                      "data": { "$ref": "#/components/schemas/Chapter" }
                    }
                  }
                }
              }
            },
            "404": { "description": "Chapter không tìm thấy hoặc không có quyền" }
          }
        },
        "patch": {
          "tags": ["Submissions"],
          "summary": "Gỡ TE khỏi chapter (gán te_id = null)",
          "security": [{ "BearerAuth": [] }],
          "parameters": [
            { "in": "path", "name": "chapterId", "required": true, "schema": { "type": "string" }, "description": "Chapter ID" }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": ["te_id"],
                  "properties": {
                    "te_id": {
                      "type": "string",
                      "example": "null",
                      "description": "Đặt null để gỡ TE"
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": { "description": "TE đã được gỡ" }
          }
        }
      },
`;

const idx = content.indexOf(approveRoute);
if (idx === -1) {
    console.log('ERROR: approve route not found');
    process.exit(1);
}

content = content.slice(0, idx) + assignTeBlock + content.slice(idx);
fs.writeFileSync(path, content, 'utf8');
console.log('assign-te (POST + PATCH) inserted before approve');
