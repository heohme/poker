import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UserProvider } from "./contexts/UserContext";
import { RoomProvider, useRoom } from "./contexts/RoomContext";
import { GameProvider } from "./contexts/GameContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UserSelection } from "./pages/UserSelection";
import { Lobby } from "./pages/Lobby";
import { RoomCreate } from "./pages/RoomCreate";
import GameRoom from "./pages/GameRoom";

// 包装组件来传递Room数据给GameProvider
const GameProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRoom, roomPlayers } = useRoom();
  return (
    <GameProvider currentRoom={currentRoom} roomPlayers={roomPlayers}>
      {children}
    </GameProvider>
  );
};

export default function App() {
  return (
    <UserProvider>
      <RoomProvider>
        <GameProviderWrapper>
          <Router>
        <Routes>
          <Route path="/" element={<UserSelection />} />
          <Route path="/user-selection" element={<UserSelection />} />
          <Route 
            path="/lobby" 
            element={
              <ProtectedRoute>
                <Lobby />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/room/create" 
            element={
              <ProtectedRoute>
                <RoomCreate />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/room/:roomId" 
            element={
              <ProtectedRoute>
                <GameRoom />
              </ProtectedRoute>
            } 
          />
        </Routes>
          </Router>
        </GameProviderWrapper>
      </RoomProvider>
    </UserProvider>
  );
}
