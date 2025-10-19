import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast, Toaster } from "sonner";
import { Search, Plus, X, Settings, Download, Save, Sparkles, Code2, FileCode } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Home() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlugins, setSelectedPlugins] = useState([]);
  const [generatedCode, setGeneratedCode] = useState("");
  const [addConfigs, setAddConfigs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availablePlugins, setAvailablePlugins] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [configName, setConfigName] = useState("");

  useEffect(() => {
    loadAvailablePlugins();
  }, []);

  const loadAvailablePlugins = async () => {
    try {
      const response = await axios.get(`${API}/plugins`);
      setAvailablePlugins(response.data);
    } catch (error) {
      console.error("Error loading plugins:", error);
    }
  };

  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await axios.get(`${API}/plugins/search?q=${term}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const addPlugin = (plugin) => {
    if (!selectedPlugins.find(p => p.name === plugin.name)) {
      setSelectedPlugins([...selectedPlugins, plugin]);
      toast.success(`Added ${plugin.name}`);
    }
    setSearchTerm("");
    setSearchResults([]);
  };

  const removePlugin = (pluginName) => {
    setSelectedPlugins(selectedPlugins.filter(p => p.name !== pluginName));
  };

  const generateConfig = async () => {
    if (selectedPlugins.length === 0) {
      toast.error("Please add at least one plugin");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/config/generate`, {
        plugin_names: selectedPlugins.map(p => p.name),
        add_configs: addConfigs
      });
      setGeneratedCode(response.data.lua_code);
      toast.success(`Generated config with ${response.data.plugins_count} plugins!`);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!configName.trim()) {
      toast.error("Please enter a configuration name");
      return;
    }

    try {
      await axios.post(`${API}/config/save`, {
        name: configName,
        lua_code: generatedCode,
        plugins: selectedPlugins.map(p => p.name)
      });
      toast.success("Configuration saved successfully!");
      setSaveDialogOpen(false);
      setConfigName("");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save configuration");
    }
  };

  const downloadConfig = () => {
    const blob = new Blob([generatedCode], { type: "text/x-lua" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "packer-config.lua";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Configuration downloaded!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Packer.ai
                </h1>
                <p className="text-xs text-slate-500">Intelligent Neovim Configuration Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                data-testid="view-saved-configs-btn"
                variant="outline"
                onClick={() => navigate('/saved')}
                className="gap-2"
              >
                <FileCode className="w-4 h-4" />
                Saved Configs
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Plugin Selection */}
          <div className="space-y-6">
            <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border-slate-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Build Your Configuration
                  </h2>
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">
                    {selectedPlugins.length} plugins
                  </Badge>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    data-testid="plugin-search-input"
                    placeholder="Search plugins (e.g., telescope, nvim-tree)..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 border-slate-300 focus:border-cyan-500 focus:ring-cyan-500"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-10">
                      {searchResults.map((plugin) => (
                        <div
                          key={plugin.name}
                          data-testid={`search-result-${plugin.name}`}
                          onClick={() => addPlugin(plugin)}
                          className="p-3 hover:bg-cyan-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-slate-800">{plugin.name}</div>
                          <div className="text-xs text-slate-500">{plugin.repo}</div>
                          {plugin.description && (
                            <div className="text-xs text-slate-600 mt-1">{plugin.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Plugins */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Selected Plugins</h3>
                  {selectedPlugins.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                      <Code2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Search and add plugins to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {selectedPlugins.map((plugin) => (
                        <div
                          key={plugin.name}
                          data-testid={`selected-plugin-${plugin.name}`}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200 group hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-slate-800 text-sm">{plugin.name}</div>
                            <div className="text-xs text-slate-500">{plugin.repo}</div>
                          </div>
                          <Button
                            data-testid={`remove-plugin-${plugin.name}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => removePlugin(plugin.name)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="flex items-center space-x-2 pt-4 border-t border-slate-200">
                  <Checkbox
                    data-testid="add-configs-checkbox"
                    id="add-configs"
                    checked={addConfigs}
                    onCheckedChange={setAddConfigs}
                    className="border-cyan-500 data-[state=checked]:bg-cyan-500"
                  />
                  <label
                    htmlFor="add-configs"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Include default configurations
                  </label>
                </div>

                {/* Generate Button */}
                <Button
                  data-testid="generate-config-btn"
                  onClick={generateConfig}
                  disabled={loading || selectedPlugins.length === 0}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/30 transition-all hover:shadow-xl hover:shadow-cyan-500/40"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generate Configuration
                    </span>
                  )}
                </Button>
              </div>
            </Card>

            {/* Popular Plugins */}
            <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Popular Plugins</h3>
              <div className="flex flex-wrap gap-2">
                {availablePlugins.slice(0, 10).map((plugin) => (
                  <Badge
                    key={plugin.name}
                    data-testid={`popular-plugin-${plugin.name}`}
                    onClick={() => addPlugin(plugin)}
                    className="cursor-pointer bg-slate-100 hover:bg-cyan-100 text-slate-700 hover:text-cyan-700 border border-slate-300 hover:border-cyan-400 transition-all"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {plugin.name}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Panel - Code Preview */}
          <div className="space-y-6">
            <Card className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border-slate-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-800" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Generated Configuration
                  </h2>
                  {generatedCode && (
                    <div className="flex gap-2">
                      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="save-config-btn" variant="outline" size="sm" className="gap-2">
                            <Save className="w-4 h-4" />
                            Save
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Configuration</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <Input
                              data-testid="config-name-input"
                              placeholder="Enter configuration name..."
                              value={configName}
                              onChange={(e) => setConfigName(e.target.value)}
                            />
                            <Button data-testid="save-config-submit-btn" onClick={saveConfig} className="w-full">
                              Save Configuration
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        data-testid="download-config-btn"
                        variant="outline"
                        size="sm"
                        onClick={downloadConfig}
                        className="gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>

                {generatedCode ? (
                  <div className="relative">
                    <pre data-testid="generated-code-preview" className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono border border-slate-700 max-h-[600px] overflow-y-auto">
                      {generatedCode}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <Settings className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">No configuration generated yet</p>
                    <p className="text-sm">Select plugins and click "Generate Configuration"</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}