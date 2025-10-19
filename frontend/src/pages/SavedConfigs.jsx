import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Trash2, Download, FileCode, Calendar, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SavedConfigs() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await axios.get(`${API}/config/list`);
      setConfigs(response.data);
    } catch (error) {
      console.error("Error loading configs:", error);
      toast.error("Failed to load saved configurations");
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async (configId) => {
    try {
      await axios.delete(`${API}/config/${configId}`);
      setConfigs(configs.filter(c => c.id !== configId));
      toast.success("Configuration deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete configuration");
    }
  };

  const downloadConfig = (config) => {
    const blob = new Blob([config.lua_code], { type: "text/x-lua" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '-')}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Configuration downloaded!");
  };

  const viewConfig = (config) => {
    setSelectedConfig(config);
    setViewDialogOpen(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                data-testid="back-to-home-btn"
                variant="ghost"
                onClick={() => navigate('/')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex items-center gap-3 ml-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <FileCode className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    Saved Configurations
                  </h1>
                  <p className="text-xs text-slate-500">{configs.length} configurations saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-16">
            <FileCode className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No saved configurations</h3>
            <p className="text-slate-500 mb-6">Create your first configuration to get started</p>
            <Button
              data-testid="create-first-config-btn"
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Configuration
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <Card
                key={config.id}
                data-testid={`saved-config-${config.id}`}
                className="p-6 bg-white/90 backdrop-blur-sm shadow-lg border-slate-200 hover:shadow-xl transition-shadow"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {config.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(config.created_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {config.plugins.slice(0, 5).map((plugin) => (
                      <Badge
                        key={plugin}
                        variant="secondary"
                        className="text-xs bg-cyan-100 text-cyan-700"
                      >
                        {plugin}
                      </Badge>
                    ))}
                    {config.plugins.length > 5 && (
                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                        +{config.plugins.length - 5} more
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      data-testid={`view-config-${config.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => viewConfig(config)}
                      className="flex-1"
                    >
                      View Code
                    </Button>
                    <Button
                      data-testid={`download-config-${config.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => downloadConfig(config)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          data-testid={`delete-config-${config.id}`}
                          variant="outline"
                          size="sm"
                          className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{config.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            data-testid={`confirm-delete-${config.id}`}
                            onClick={() => deleteConfig(config.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedConfig?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            <pre data-testid="config-code-preview" className="bg-slate-900 text-green-400 p-4 rounded-lg text-sm font-mono">
              {selectedConfig?.lua_code}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}