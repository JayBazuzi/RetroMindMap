import { greeting } from "./greeting";

document.querySelector<HTMLDivElement>("#app")!.textContent =
  greeting("Retro Mind Map");
