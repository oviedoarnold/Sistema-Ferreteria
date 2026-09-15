import { beforeEach } from "vitest"

import "@testing-library/jest-dom/vitest"

/*
  El sistema guarda todo en localStorage.
  Cada test arranca con el almacenamiento
  limpio para que no se contaminen entre sí.
*/
beforeEach(() => {
  localStorage.clear()
})

/*
  jsdom no implementa matchMedia y alguna pantalla lo consulta para respetar
  la preferencia de movimiento reducido. Se responde que no hay preferencia,
  que es lo que asume el navegador cuando no la hay.
*/
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
