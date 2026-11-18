import type { SuperType } from "../../data/SuperData";
import type { SuperBase } from "./SuperBase";
import { SuperBubble } from "./SuperBubble";
import { SuperNova } from "./SuperNova";
import { SuperTether } from "./SuperTether";
import { SuperTotem } from "./SuperTotem";

type Constructor = new (
    type: SuperType) => SuperBase

const REGISTRY: Record<SuperType, Constructor> = {
    bubble: SuperBubble,
    totem: SuperTotem,
    tether: SuperTether,
    nova: SuperNova,
};

export const SuperFactory = {
    create(type: SuperType): SuperBase {
        const EntityClass = REGISTRY[type];
        if (!EntityClass) throw new Error(`Super type ${type} not found`);
        return new EntityClass(type);
    }
}
