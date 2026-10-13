use serde_json::json;
use crate::models::{FunctionDefinition, ToolDefinition};

/// Standard tools exposed to the LLM for multimodal generation inside ArtCraft Studio.
pub fn get_studio_tools() -> Vec<ToolDefinition> {
  vec![
    ToolDefinition {
      r#type: "function".to_string(),
      function: FunctionDefinition {
        name: "generate_image".to_string(),
        description: "Generates an image when the user asks to create, draw, show, render, or generate an image or picture.".to_string(),
        parameters: json!({
          "type": "object",
          "properties": {
            "prompt": {
              "type": "string",
              "description": "The detailed English prompt describing the subject, style, lighting, composition, and visual aesthetic."
            },
            "aspect_ratio": {
              "type": "string",
              "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
              "default": "1:1",
              "description": "Aspect ratio of the generated image."
            }
          },
          "required": ["prompt"]
        }),
      },
    },
    ToolDefinition {
      r#type: "function".to_string(),
      function: FunctionDefinition {
        name: "generate_video".to_string(),
        description: "Generates an AI video or animation when the user asks to create, animate, or generate a video or motion scene.".to_string(),
        parameters: json!({
          "type": "object",
          "properties": {
            "prompt": {
              "type": "string",
              "description": "The detailed English prompt describing camera motion, subject action, environment, and cinematography."
            },
            "duration_seconds": {
              "type": "integer",
              "enum": [5, 10],
              "default": 5,
              "description": "Length of the generated video in seconds."
            }
          },
          "required": ["prompt"]
        }),
      },
    },
  ]
}
