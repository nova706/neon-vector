import type { WeaponType } from "../../data/WeaponData";
import type { IAttacker } from "../../interfaces/IAttacker";
import type { WeaponBase } from "./WeaponBase";
import { WeaponBeam } from "./WeaponBeam";
import { WeaponBurst } from "./WeaponBurst";
import { WeaponChain } from "./WeaponChain";
import { WeaponOrbit } from "./WeaponOrbit";

type Constructor = new (
    kind: WeaponType, attacker: IAttacker) => WeaponBase

const REGISTRY: Record<WeaponType, Constructor> = {
    beam: WeaponBeam,
    orbit: WeaponOrbit,
    chain: WeaponChain,
    burst: WeaponBurst
};

export const WeaponFactory = {
    create(type: WeaponType, attacker: IAttacker): WeaponBase {
        const EntityClass = REGISTRY[type];
        if (!EntityClass) throw new Error(`Weapon type ${type} not found`);
        return new EntityClass(type, attacker);
    }
}
