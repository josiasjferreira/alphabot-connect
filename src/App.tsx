import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Connection from "./pages/Connection";
import Dashboard from "./pages/Dashboard";
import Control from "./pages/Control";
import Chat from "./pages/Chat";
import Voice from "./pages/Voice";
import MapNav from "./pages/MapNav";
import Telemetry from "./pages/Telemetry";
import Settings from "./pages/Settings";
import ProductShowcase from "./pages/ProductShowcase";
import Diagnostics from "./pages/Diagnostics";
import Delivery from "./pages/Delivery";
import Patrol from "./pages/Patrol";
import Blessing from "./pages/Blessing";
import SlamMaps from "./pages/SlamMaps";
import MqttMonitor from "./pages/MqttMonitor";
import OtaUpdate from "./pages/OtaUpdate";
import AdvancedLogs from "./pages/AdvancedLogs";
import InteractionAdmin from "./pages/InteractionAdmin";
import RobotConnectionScanner from "./pages/RobotConnectionScanner";
import DeliveryFlowTest from "./pages/DeliveryFlowTest";
import Media from "./pages/Media";
import Rotation from "./pages/Rotation";
import Calibration from "./pages/Calibration";
import RobotCalibrationPanel from "./components/RobotCalibrationPanel";
import NetworkDiagnostics from "./pages/NetworkDiagnostics";
import MqttConfig from "./pages/MqttConfig";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Connection />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/control" element={<Control />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/voice" element={<Voice />} />
          <Route path="/map" element={<MapNav />} />
          <Route path="/telemetry" element={<Telemetry />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/showcase" element={<ProductShowcase />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/patrol" element={<Patrol />} />
          <Route path="/blessing" element={<Blessing />} />
          <Route path="/slam" element={<SlamMaps />} />
          <Route path="/mqtt" element={<MqttMonitor />} />
          <Route path="/ota" element={<OtaUpdate />} />
          <Route path="/logs" element={<AdvancedLogs />} />
          <Route path="/interactions" element={<InteractionAdmin />} />
          <Route path="/scanner" element={<RobotConnectionScanner />} />
          <Route path="/delivery-test" element={<DeliveryFlowTest />} />
          <Route path="/media" element={<Media />} />
          <Route path="/rotation" element={<Rotation />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/calibration-wifi" element={<RobotCalibrationPanel />} />
          <Route path="/network-diagnostics" element={<NetworkDiagnostics />} />
          <Route path="/mqtt-config" element={<MqttConfig />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
