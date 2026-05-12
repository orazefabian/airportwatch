import Navbar from "../components/Navbar";
import AirportSelector from "../components/AirportSelector";

export default function Select() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <AirportSelector />
      </main>
    </div>
  );
}
