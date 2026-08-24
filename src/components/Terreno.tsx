"use client";

import { useMemo } from "react";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import { construirGeometriaHoyo, trimeshDesdeGeometria } from "@/lib/geometria";
import { ESTILO_MATERIAL } from "@/lib/materiales";
import { friccionEnMaterial } from "@/lib/fisica";
import { obtenerTexturaCesped } from "@/lib/texturas";
import type { Celda, Material, Pelota } from "@/lib/tipos";

/**
 * Terreno de un hoyo: **una geometría fusionada por material** (§9 — nunca un
 * `<mesh>` por bloque) y un `TrimeshCollider` estático por cada una de esas
 * geometrías (§9 también pide un único collider por hoyo; con pocos
 * materiales por hoyo, uno por material es el equivalente práctico que
 * además permite variar la fricción por material sin un solo mesh gigante).
 */
/** Solo el césped tiene textura propia por ahora; el resto se queda en color liso (§3 no lo pide). */
function texturaDe(material: Material): ReturnType<typeof obtenerTexturaCesped> {
  return material === "cesped" ? obtenerTexturaCesped() : undefined;
}

export function Terreno({ celdas, pelota }: { celdas: Celda[]; pelota: Pelota }) {
  const grupos = useMemo(() => construirGeometriaHoyo(celdas), [celdas]);

  return (
    <>
      {grupos.map(({ material, geometria }) => {
        const estilo = ESTILO_MATERIAL[material];
        const { vertices, indices } = trimeshDesdeGeometria(geometria);
        // La fricción real es friccionBase(pelota) * multiplicador(material)
        // (fisica.ts). Rapier combina la fricción de dos colliders con la
        // MEDIA por defecto, así que aquí se pone al doble y en la bola a 0:
        // (0 + 2·f) / 2 = f. Evita depender del enum de combine-rule de Rapier.
        const friccionColisionador = friccionEnMaterial(pelota, material) * 2;
        const textura = texturaDe(material);
        return (
          <RigidBody
            key={material}
            type="fixed"
            colliders={false}
            friction={friccionColisionador}
            restitution={0}
          >
            <mesh geometry={geometria} castShadow receiveShadow>
              <meshStandardMaterial
                // Con textura, el color debe quedar en blanco: meshStandardMaterial
                // multiplica color×map, y estilo.color ya está "dentro" de la textura.
                color={textura ? "#ffffff" : estilo.color}
                map={textura}
                roughness={estilo.rugosidad}
                metalness={estilo.metalico}
                transparent={estilo.opacidad !== undefined}
                opacity={estilo.opacidad ?? 1}
              />
            </mesh>
            <TrimeshCollider args={[vertices, indices]} />
          </RigidBody>
        );
      })}
    </>
  );
}
