import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AirportSelector from "../components/AirportSelector";

const DEFAULT_AIRPORT = "LOWK";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const last = localStorage.getItem("airportwatch_last_airport");
    const target = last || DEFAULT_AIRPORT;
    navigate(`/airport/${target}`, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <AirportSelector />
      </main>
    </div>
  );
}
