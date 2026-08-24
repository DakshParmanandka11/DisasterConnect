import { createContext, useContext, useState, useEffect } from "react";

const BatteryContext = createContext();

export function BatteryProvider({ children }) {
  const [level, setLevel] = useState(null);

  useEffect(() => {
    if ("getBattery" in navigator) {
      navigator.getBattery().then((battery) => {
        setLevel(Math.round(battery.level * 100));
        battery.addEventListener("levelchange", () => {
          setLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  return (
    <BatteryContext.Provider value={{ batterySaver: true, level }}>
      {children}
    </BatteryContext.Provider>
  );
}

export function useBattery() {
  return useContext(BatteryContext);
}
