import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AirportSelector from "../components/AirportSelector";

const DEFAULT_AIRPORT = "LOWK";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Always go straight to Klagenfurt unless the user explicitly navigated here to change
    const last = localStorage.getItem("runwayscope_last_airport");
    const target = last || DEFAULT_AIRPORT;
    navigate(`/airport/${target}`, { replace: true });
  }, [navigate]);

  // Shown briefly while the redirect fires
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <AirportSelector />
      </main>
    </div>
  );
}
