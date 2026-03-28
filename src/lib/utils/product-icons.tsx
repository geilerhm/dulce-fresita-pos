"use client";

import {
  Acorn, Avocado, BeerStein, BowlFood, BowlSteam, Brandy, Bread, Cake,
  Campfire, Carrot, Cheese, Circle, CirclesFour, Coffee, CoffeeBean, Confetti,
  Cookie, CookingPot, Crown, Diamond, Drop, Egg, EggCrack, Fire, Fish, Flame,
  Flask, Flower, FlowerLotus, FlowerTulip, ForkKnife, Gift, Grains, GridFour,
  Hamburger, Heart, Hexagon, IceCream, Jar, Knife, Leaf, Lightning, Martini,
  Medal, Orange, OrangeSlice, Oven, Package, Pepper, PintGlass, Pizza, Plant,
  PlusCircle, Popcorn, Shrimp, Snowflake, Sparkle, Star, SunHorizon, Wine,
} from "@phosphor-icons/react";
import {
  Strawberry, Banana, Pineapple, Peach, KiwiFruit, Watermelon, Grape, Mango, Coconut, Lemon,
  FRUIT_ICONS,
} from "./fruit-icons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PHOSPHOR_ICONS: Record<string, any> = {
  OrangeSlice, Orange, Coffee, CoffeeBean, PintGlass, Wine, Jar, Drop,
  IceCream, Cookie, Bread, Cake, Hamburger, Cheese, BowlFood, ForkKnife,
  Sparkle, Star, Fire, Snowflake, GridFour, CirclesFour, Hexagon, Diamond,
  Circle, PlusCircle, Package, Acorn, Avocado, BeerStein, BowlSteam, Brandy,
  Campfire, Carrot, Confetti, CookingPot, Crown, Egg, EggCrack, Fish, Flame,
  Flask, Flower, FlowerLotus, FlowerTulip, Gift, Grains, Heart, Knife, Leaf,
  Lightning, Martini, Medal, Oven, Pepper, Pizza, Plant, Popcorn, Shrimp,
  SunHorizon,
};

// Combined map
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  ...FRUIT_ICONS,
  ...PHOSPHOR_ICONS,
};

// Organized by category for the icon picker
export const ICON_CATEGORIES = [
  { label: "Frutas", icons: ["Strawberry", "Banana", "Pineapple", "Peach", "KiwiFruit", "Watermelon", "Grape", "Mango", "Coconut", "Lemon", "OrangeSlice", "Orange", "Avocado", "Acorn"] },
  { label: "Comida", icons: ["IceCream", "Cookie", "Bread", "Cake", "Pizza", "Hamburger", "Egg", "EggCrack", "Cheese", "Shrimp", "Fish", "Popcorn", "Grains", "Carrot", "Pepper"] },
  { label: "Bebidas", icons: ["Coffee", "CoffeeBean", "PintGlass", "Wine", "BeerStein", "Brandy", "Martini", "Flask", "Drop"] },
  { label: "Cocina", icons: ["ForkKnife", "CookingPot", "Oven", "Knife", "BowlFood", "BowlSteam", "Jar", "Leaf", "Plant"] },
  { label: "Formas", icons: ["Circle", "Diamond", "Hexagon", "GridFour", "CirclesFour", "Star", "Sparkle", "Heart", "Crown", "Lightning"] },
  { label: "Otros", icons: ["Fire", "Flame", "Snowflake", "SunHorizon", "Campfire", "Flower", "FlowerLotus", "FlowerTulip", "Gift", "Confetti", "Medal", "Package", "PlusCircle"] },
];

interface ProductIconProps {
  name: string;
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
}

export function ProductIcon({ name, size = 32, weight = "duotone", className }: ProductIconProps) {
  const Icon = ICON_MAP[name] || ForkKnife;
  // Custom fruit icons don't support weight prop
  if (FRUIT_ICONS[name]) {
    return <Icon size={size} className={className} />;
  }
  return <Icon size={size} weight={weight} className={className} />;
}

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);
