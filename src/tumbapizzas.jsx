import React from "react";

const MENU = [
  {
    id: "premium",
    name: "PIZZAS PREMIUM",
    items: [
      { id: "p01", name: "De la planta - Bechamel de coco | Cebolla | Parmesano vegano | Tomillo", price: 480 },
      { id: "p02", name: "Cabrío - Rúcula | Queso de cabra | Miel | Nueces", price: 620 },
      { id: "p03", name: "Cuchillo de palo - Cebo figazza | Romesco | Parmesano", price: 460 },
      { id: "p04", name: "Testigo falso - Pepperoni | Merkén", price: 580 },
      { id: "p05", name: "A otra rata - 3 quesos", price: 560 },
      { id: "p06", name: "Prende tuba - Bondiola | Chimichanga | Nueces", price: 560 },
    ],
  },

  {
    id: "clasicas",
    name: "PIZZAS CLÁSICAS",
    items: [
      { id: "c01", name: "Atala con alambre - Cebolla | Muzzarella | Tomillo", price: 420 },
      { id: "c02", name: "Margarita", price: 480 },
      { id: "c03", name: "La vieja confiable - Muzzarella", price: 420 },
      { id: "c04", name: "En mi salsa - Marinara", price: 380 },
      { id: "c05", name: "Fainá", price: 220 },
    ],
  },

  {
    id: "combos",
    name: "COMBOS",
    items: [
      { id: "co01", name: "Una pizza clásica + Norteña 473cc", price: 520 },
      { id: "co02", name: "Dos pizzas clásicas + 2 Norteña 473cc", price: 1050 },
      { id: "co03", name: "Dos pizzas premium + 2 Norteña 473cc", price: 1280 },
      { id: "co04", name: "Dos pizzas premium + Fainá", price: 990 },
    ],
  },

  {
    id: "postres",
    name: "POSTRES",
    items: [
      { id: "po01", name: "Húmeda de chocolate", price: 0 },
      { id: "po02", name: "Budín de pan", price: 0 },
      { id: "po03", name: "Chocotorta", price: 0 },
    ],
  },

  {
    id: "extras",
    name: "EXTRAS",
    items: [
      { id: "e01", name: "Dip pesto", price: 0 },
      { id: "e02", name: "Dip romesco", price: 0 },
      { id: "e03", name: "Dip chimichanga", price: 0 },
    ],
  },

  {
    id: "bebidas",
    name: "BEBIDAS",
    items: [
      { id: "b01", name: "Línea Coca Cola", price: 140 },
      { id: "b02", name: "Norteña 473cc", price: 150 },
    ],
  },
];

export default function TumbaPizzas() {
  return (
    <div className="min-h-screen bg-white text-black p-10">
      <h1 className="text-5xl mb-10">TUMBA PIZZAS</h1>

      {MENU.map((cat) => (
        <div key={cat.id} className="mb-10">
          <h2 className="text-2xl mb-4">{cat.name}</h2>

          <div className="space-y-2">
            {cat.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between border-b py-2"
              >
                <span>{item.name}</span>
                <span>${item.price}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
