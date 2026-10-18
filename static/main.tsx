import { createRoot } from "react-dom/client";
import "./app.css";
import { Route } from "../src/routes/index";

const Home = (Route as unknown as { options: { component: () => JSX.Element } }).options.component;
createRoot(document.getElementById("root")!).render(<Home />);
