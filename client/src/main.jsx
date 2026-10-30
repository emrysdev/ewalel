import { createRoot } from "react-dom/client";
import "./styles.css";
import Customer from "./Customer.jsx";
import Admin from "./Admin.jsx";

// "/" is the guest website, "/admin" is the owner dashboard.
createRoot(document.getElementById("root")).render(location.pathname.startsWith("/admin") ? <Admin /> : <Customer />);
