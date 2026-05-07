import { useEffect, useState } from "react";

export function useCountdown(totalSeconds) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) return totalSeconds;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [totalSeconds]);

  return remaining;
}
