import css from "./style.css";
import { mount } from "./app.ts";

const STYLE_ID = "vinyl-style";

// Spicetify requires render() to return a React element; the page itself is plain DOM.
function Host() {
  const React = Spicetify.React;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.appendChild(style);
    }

    const unmount = mount(root);
    return () => {
      unmount();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return React.createElement("div", { ref, className: "vinyl-host" });
}

export function render() {
  return Spicetify.React.createElement(Host);
}
