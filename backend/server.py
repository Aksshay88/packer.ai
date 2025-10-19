from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize LLM
llm_key = os.environ.get('EMERGENT_LLM_KEY')

# Define Models
class PluginBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    repo: str
    description: Optional[str] = None
    common_dependencies: List[str] = Field(default_factory=list)
    default_config: Optional[str] = None
    config_template: Optional[str] = None

class Plugin(PluginBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PluginCreate(PluginBase):
    pass

class GeneratePluginRequest(BaseModel):
    plugin_name: str
    add_config: bool = False
    use_opts: Optional[Dict[str, Any]] = None  # {opt: true, branch: "dev", tag: "v1.0"}
    custom_requires: Optional[List[str]] = None

class GeneratePluginResponse(BaseModel):
    lua_code: str
    suggested_dependencies: List[str] = Field(default_factory=list)
    config_included: bool = False

class SavedConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    lua_code: str
    plugins: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SavedConfigCreate(BaseModel):
    name: str
    lua_code: str
    plugins: List[str]

class GenerateCompleteConfigRequest(BaseModel):
    plugin_names: List[str]
    add_configs: bool = False
    custom_setup: Optional[str] = None

# Plugin Knowledge Base
PLUGIN_DATABASE = {
    "nvim-tree": {
        "repo": "nvim-tree/nvim-tree.lua",
        "description": "A file explorer tree for neovim",
        "dependencies": ["nvim-tree/nvim-web-devicons"],
        "config": """require('nvim-tree').setup({
  view = {
    width = 30,
  },
  renderer = {
    group_empty = true,
  },
  filters = {
    dotfiles = false,
  },
})"""
    },
    "telescope": {
        "repo": "nvim-telescope/telescope.nvim",
        "description": "Fuzzy finder over lists",
        "dependencies": ["nvim-lua/plenary.nvim"],
        "config": """require('telescope').setup({
  defaults = {
    prompt_prefix = '🔍 ',
    selection_caret = '➜ ',
    path_display = {'smart'},
  },
})"""
    },
    "treesitter": {
        "repo": "nvim-treesitter/nvim-treesitter",
        "description": "Treesitter configurations and abstraction layer",
        "dependencies": [],
        "config": """require('nvim-treesitter.configs').setup({
  ensure_installed = { 'lua', 'vim', 'python', 'javascript' },
  highlight = {
    enable = true,
  },
})"""
    },
    "lualine": {
        "repo": "nvim-lualine/lualine.nvim",
        "description": "A blazing fast and easy to configure statusline",
        "dependencies": ["nvim-tree/nvim-web-devicons"],
        "config": """require('lualine').setup({
  options = {
    theme = 'auto',
    component_separators = '|',
    section_separators = '',
  },
})"""
    },
    "nvim-cmp": {
        "repo": "hrsh7th/nvim-cmp",
        "description": "A completion plugin for neovim",
        "dependencies": ["hrsh7th/cmp-nvim-lsp", "hrsh7th/cmp-buffer", "L3MON4D3/LuaSnip"],
        "config": """local cmp = require('cmp')
cmp.setup({
  snippet = {
    expand = function(args)
      require('luasnip').lsp_expand(args.body)
    end,
  },
  mapping = cmp.mapping.preset.insert({
    ['<CR>'] = cmp.mapping.confirm({ select = true }),
  }),
  sources = cmp.config.sources({
    { name = 'nvim_lsp' },
    { name = 'buffer' },
  })
})"""
    },
    "gitsigns": {
        "repo": "lewis6991/gitsigns.nvim",
        "description": "Git integration for buffers",
        "dependencies": [],
        "config": """require('gitsigns').setup({
  signs = {
    add = { text = '+' },
    change = { text = '~' },
    delete = { text = '_' },
  },
})"""
    },
    "indent-blankline": {
        "repo": "lukas-reineke/indent-blankline.nvim",
        "description": "Indent guides for Neovim",
        "dependencies": [],
        "config": """require('ibl').setup({
  indent = {
    char = '│',
  },
})"""
    },
    "bufferline": {
        "repo": "akinsho/bufferline.nvim",
        "description": "A snazzy buffer line with tabpage integration",
        "dependencies": ["nvim-tree/nvim-web-devicons"],
        "config": """require('bufferline').setup({
  options = {
    mode = 'buffers',
    separator_style = 'slant',
  },
})"""
    },
    "alpha": {
        "repo": "goolord/alpha-nvim",
        "description": "A fast and fully customizable greeter for neovim",
        "dependencies": ["nvim-tree/nvim-web-devicons"],
        "config": """require('alpha').setup(require('alpha.themes.dashboard').config)"""
    },
    "which-key": {
        "repo": "folke/which-key.nvim",
        "description": "Display possible keybindings in popup",
        "dependencies": [],
        "config": """require('which-key').setup({})"""
    },
    "nvim-autopairs": {
        "repo": "windwp/nvim-autopairs",
        "description": "Autopairs for neovim",
        "dependencies": [],
        "config": """require('nvim-autopairs').setup({})"""
    },
    "comment": {
        "repo": "numToStr/Comment.nvim",
        "description": "Smart and powerful commenting plugin",
        "dependencies": [],
        "config": """require('Comment').setup({})"""
    },
    "neo-tree": {
        "repo": "nvim-neo-tree/neo-tree.nvim",
        "description": "File explorer with git integration",
        "dependencies": ["nvim-lua/plenary.nvim", "nvim-tree/nvim-web-devicons", "MunifTanjim/nui.nvim"],
        "config": """require('neo-tree').setup({})"""
    },
    "toggleterm": {
        "repo": "akinsho/toggleterm.nvim",
        "description": "Terminal management plugin",
        "dependencies": [],
        "config": """require('toggleterm').setup({
  size = 20,
  open_mapping = [[<c-\\>]],
})"""
    },
    "null-ls": {
        "repo": "jose-elias-alvarez/null-ls.nvim",
        "description": "Use Neovim as a language server",
        "dependencies": ["nvim-lua/plenary.nvim"],
        "config": """require('null-ls').setup({})"""
    }
}

def normalize_plugin_name(name: str) -> tuple[str, str]:
    """Normalize plugin name and get repo. Returns (normalized_name, repo)"""
    name = name.lower().strip()
    
    # Check exact match in database
    if name in PLUGIN_DATABASE:
        return name, PLUGIN_DATABASE[name]["repo"]
    
    # Check if it's already a full repo path
    if '/' in name:
        parts = name.split('/')
        if len(parts) == 2:
            # Check if it matches any plugin's repo
            for plugin_name, data in PLUGIN_DATABASE.items():
                if data["repo"].lower() == name:
                    return plugin_name, data["repo"]
            return parts[1].replace('.nvim', '').replace('.lua', ''), name
    
    # Partial name matching
    for plugin_name, data in PLUGIN_DATABASE.items():
        if name in plugin_name or name in data["repo"].lower():
            return plugin_name, data["repo"]
    
    # If not found, return as-is and guess repo
    clean_name = name.replace('nvim-', '').replace('.nvim', '').replace('.lua', '')
    return name, f"unknown/{name}"

def generate_lua_use_block(plugin_name: str, repo: str, add_config: bool = False,
                          use_opts: Dict[str, Any] = None, custom_requires: List[str] = None,
                          plugin_info: Dict = None) -> str:
    """Generate a Packer use block for a plugin"""
    lines = [f"  use {{"]  # 2 spaces indent for use block
    lines.append(f"    '{repo}',")  # 4 spaces for content
    
    # Add options
    if use_opts:
        if use_opts.get('opt'):
            lines.append("    opt = true,")
        if use_opts.get('branch'):
            lines.append(f"    branch = '{use_opts['branch']}',")
        if use_opts.get('tag'):
            lines.append(f"    tag = '{use_opts['tag']}',")
    
    # Add dependencies
    requires = custom_requires or (plugin_info.get('dependencies', []) if plugin_info else [])
    if requires:
        if len(requires) == 1:
            lines.append(f"    requires = '{requires[0]}',")
        else:
            lines.append("    requires = {")
            for dep in requires:
                lines.append(f"      '{dep}',")
            lines.append("    },")
    
    # Add config
    if add_config and plugin_info and plugin_info.get('config'):
        lines.append("    config = function()")
        config_lines = plugin_info['config'].split('\n')
        for config_line in config_lines:
            lines.append(f"      {config_line}")
        lines.append("    end,")
    
    lines.append("  }")
    return "\n".join(lines)

async def ai_enhance_config(plugin_name: str, repo: str, base_config: str = None) -> str:
    """Use AI to enhance or suggest plugin configuration"""
    try:
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"packer-{uuid.uuid4()}",
            system_message="You are an expert Neovim plugin configuration assistant. Generate clean, idiomatic Lua code for Packer.nvim plugin configurations. Return ONLY the Lua code without explanations."
        ).with_model("openai", "gpt-5")
        
        prompt = f"""Generate a Packer use block for the Neovim plugin: {repo}
        
Plugin name: {plugin_name}
Base config: {base_config if base_config else 'Generate a sensible default configuration'}

Return clean Lua code in this format:
use {{
  'repo/path',
  requires = {{ ... }},
  config = function()
    -- config here
  end
}}

Only return the Lua code, no markdown or explanations."""
        
        response = await chat.send_message(UserMessage(text=prompt))
        # Clean up response
        cleaned = response.strip()
        # Remove markdown code blocks if present
        cleaned = re.sub(r'^```lua\n', '', cleaned)
        cleaned = re.sub(r'\n```$', '', cleaned)
        return cleaned
    except Exception as e:
        logging.error(f"AI enhancement failed: {e}")
        return None

# Seed database with plugins
@app.on_event("startup")
async def seed_plugins():
    """Seed the database with common plugins"""
    count = await db.plugins.count_documents({})
    if count == 0:
        logging.info("Seeding plugin database...")
        for name, data in PLUGIN_DATABASE.items():
            plugin = Plugin(
                name=name,
                repo=data["repo"],
                description=data.get("description"),
                common_dependencies=data.get("dependencies", []),
                default_config=data.get("config"),
                config_template=data.get("config")
            )
            doc = plugin.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.plugins.insert_one(doc)
        logging.info(f"Seeded {len(PLUGIN_DATABASE)} plugins")

# Routes
@api_router.get("/")
async def root():
    return {"message": "Packer.ai - Neovim Configuration Generator"}

@api_router.get("/plugins", response_model=List[Plugin])
async def get_plugins():
    """Get all available plugins"""
    plugins = await db.plugins.find({}, {"_id": 0}).to_list(1000)
    for plugin in plugins:
        if isinstance(plugin.get('created_at'), str):
            plugin['created_at'] = datetime.fromisoformat(plugin['created_at'])
    return plugins

@api_router.get("/plugins/search")
async def search_plugins(q: str):
    """Search plugins by name or description"""
    regex = {"$regex": q, "$options": "i"}
    plugins = await db.plugins.find({
        "$or": [
            {"name": regex},
            {"repo": regex},
            {"description": regex}
        ]
    }, {"_id": 0}).to_list(20)
    
    for plugin in plugins:
        if isinstance(plugin.get('created_at'), str):
            plugin['created_at'] = datetime.fromisoformat(plugin['created_at'])
    
    return plugins

@api_router.post("/plugin/generate", response_model=GeneratePluginResponse)
async def generate_plugin(request: GeneratePluginRequest):
    """Generate a Packer use block for a single plugin"""
    # Normalize plugin name
    normalized_name, repo = normalize_plugin_name(request.plugin_name)
    
    # Get plugin info from database or built-in knowledge
    plugin_info = PLUGIN_DATABASE.get(normalized_name)
    
    # If repo is unknown, try AI enhancement
    if repo.startswith("unknown/"):
        ai_code = await ai_enhance_config(request.plugin_name, request.plugin_name)
        if ai_code:
            return GeneratePluginResponse(
                lua_code=ai_code,
                suggested_dependencies=[],
                config_included=request.add_config
            )
        raise HTTPException(status_code=404, detail=f"Plugin '{request.plugin_name}' not found")
    
    # Generate Lua code
    lua_code = generate_lua_use_block(
        normalized_name,
        repo,
        request.add_config,
        request.use_opts or {},
        request.custom_requires,
        plugin_info
    )
    
    suggested_deps = plugin_info.get('dependencies', []) if plugin_info else []
    
    return GeneratePluginResponse(
        lua_code=lua_code,
        suggested_dependencies=suggested_deps,
        config_included=request.add_config
    )

@api_router.post("/config/generate")
async def generate_complete_config(request: GenerateCompleteConfigRequest):
    """Generate a complete Packer configuration with multiple plugins"""
    lines = [
        "-- Packer.nvim configuration",
        "-- Generated by Packer.ai",
        "",
        "return require('packer').startup(function(use)",
        "  -- Packer can manage itself",
        "  use 'wbthomason/packer.nvim'",
        ""
    ]
    
    all_dependencies = set()
    processed_plugins = set()
    
    for plugin_name in request.plugin_names:
        normalized_name, repo = normalize_plugin_name(plugin_name)
        
        if repo in processed_plugins:
            continue
        processed_plugins.add(repo)
        
        plugin_info = PLUGIN_DATABASE.get(normalized_name)
        
        # Collect dependencies
        if plugin_info:
            for dep in plugin_info.get('dependencies', []):
                all_dependencies.add(dep)
        
        # Generate use block
        lua_code = generate_lua_use_block(
            normalized_name,
            repo,
            request.add_configs,
            {},
            None,
            plugin_info
        )
        lines.append(lua_code)
        lines.append("")
    
    # Add custom setup if provided
    if request.custom_setup:
        lines.append("  -- Custom setup")
        lines.append(f"  {request.custom_setup}")
        lines.append("")
    
    lines.append("end)")
    
    return {
        "lua_code": "\n".join(lines),
        "plugins_count": len(processed_plugins),
        "total_dependencies": len(all_dependencies),
        "dependencies": list(all_dependencies)
    }

@api_router.post("/config/save", response_model=SavedConfig)
async def save_config(config: SavedConfigCreate):
    """Save a configuration"""
    saved = SavedConfig(**config.model_dump())
    doc = saved.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.saved_configs.insert_one(doc)
    return saved

@api_router.get("/config/list", response_model=List[SavedConfig])
async def list_configs():
    """List all saved configurations"""
    configs = await db.saved_configs.find({}, {"_id": 0}).to_list(100)
    for config in configs:
        if isinstance(config.get('created_at'), str):
            config['created_at'] = datetime.fromisoformat(config['created_at'])
        if isinstance(config.get('updated_at'), str):
            config['updated_at'] = datetime.fromisoformat(config['updated_at'])
    return configs

@api_router.get("/config/{config_id}", response_model=SavedConfig)
async def get_config(config_id: str):
    """Get a specific configuration"""
    config = await db.saved_configs.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    if isinstance(config.get('created_at'), str):
        config['created_at'] = datetime.fromisoformat(config['created_at'])
    if isinstance(config.get('updated_at'), str):
        config['updated_at'] = datetime.fromisoformat(config['updated_at'])
    return config

@api_router.delete("/config/{config_id}")
async def delete_config(config_id: str):
    """Delete a configuration"""
    result = await db.saved_configs.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return {"message": "Configuration deleted successfully"}

@api_router.post("/config/export")
async def export_config(config_id: str = None, lua_code: str = None):
    """Export configuration to downloadable format"""
    if config_id:
        config = await db.saved_configs.find_one({"id": config_id}, {"_id": 0})
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")
        lua_code = config['lua_code']
    
    if not lua_code:
        raise HTTPException(status_code=400, detail="No Lua code provided")
    
    return {
        "filename": "packer-config.lua",
        "content": lua_code,
        "content_type": "text/x-lua"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()