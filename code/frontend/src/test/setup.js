import '@testing-library/jest-dom/vitest'
<<<<<<< HEAD
=======

// Vista previa de la fotografía de perfil: Node ya implementa
// `URL.createObjectURL`/`revokeObjectURL` (devuelve una URL `blob:`); si el
// entorno de pruebas no los tuviera, basta una URL `blob:` fija.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:vista-previa'
  URL.revokeObjectURL = () => {}
}
>>>>>>> 52489aadf81c4c4204fa1b05f16a93923b146d1b
