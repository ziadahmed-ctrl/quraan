import React from "react";

interface SakinahLogoProps {
  className?: string;
  size?: number;
}

export default function SakinahLogo({ className = "", size = 48 }: SakinahLogoProps) {
  return (
    <svg
      id="sakinah_custom_logo"
      width={size}
      height={size}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        {/* Deep, premium gold gradient for borders and Quran book */}
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="30%" stopColor="#DFB76C" />
          <stop offset="70%" stopColor="#B28229" />
          <stop offset="100%" stopColor="#8A5A16" />
        </linearGradient>

        {/* Forest green background gradient */}
        <radialGradient id="greenBg" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#123E2A" />
          <stop offset="70%" stopColor="#081E14" />
          <stop offset="100%" stopColor="#040F0A" />
        </radialGradient>

        {/* Outer glow filter */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Main Hexagonal Background Layer */}
      <polygon
        points="250,15 460,136 460,378 250,485 40,378 40,136"
        fill="url(#greenBg)"
        stroke="url(#goldGradient)"
        strokeWidth="14"
        strokeLinejoin="round"
        className="drop-shadow-xl"
        style={{ filter: "url(#glow)" }}
      />

      {/* 2. Inner Hexagonal Fine Gold Border */}
      <polygon
        points="250,32 444,144 444,367 250,466 56,367 56,144"
        stroke="url(#goldGradient)"
        strokeWidth="4"
        strokeDasharray="14 10"
        strokeLinejoin="round"
        opacity="0.85"
      />

      {/* 3. Islamic Arabic/Geometric Motif Star Backdrop */}
      <g opacity="0.12" stroke="url(#goldGradient)" strokeWidth="3" fill="none">
        <path d="M 250,15 L 250,485 M 40,136 L 460,378 M 40,378 L 460,136" />
        <polygon points="250,50 425,150 425,350 250,450 75,350 75,150" />
        <circle cx="250" cy="250" r="140" strokeDasharray="5,10" />
      </g>

      {/* 4. Elegant Arabesque Corner Accents (Inside Hexagon corners) */}
      <path
        d="M 230,55 Q 250,40 270,55 
           M 415,145 Q 430,130 420,115
           M 415,355 Q 430,370 420,385
           M 230,445 Q 250,460 270,445
           M 85,355 Q 70,370 80,385
           M 85,145 Q 70,130 80,115"
        stroke="url(#goldGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* 5. Center Piece: The Sacred Holy Quran opened Book */}
      <g id="holy_quran_book" className="drop-shadow-lg">
        {/* Backing pages thickness / depth shadow */}
        <path
          d="M 250,314 
             C 210,296 170,294 130,314 L 130,194 C 170,174 210,176 250,194 Z 
             M 250,314 
             C 290,296 330,294 370,314 L 370,194 C 330,174 290,176 250,194 Z"
          fill="#523910"
          opacity="0.5"
        />

        {/* Main Golden Book Pages */}
        <path
          d="M 250,305 
             C 210,287 170,285 130,305 L 130,185 C 170,165 210,167 250,185 Z"
          fill="url(#goldGradient)"
          stroke="#402000"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M 250,305 
             C 290,287 330,285 370,305 L 370,185 C 330,165 290,167 250,185 Z"
          fill="url(#goldGradient)"
          stroke="#402000"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Beautiful Inside Engraving Lines on the Quran's Left Page */}
        <path
          d="M 150,200 Q 185,190 230,200
             M 152,225 Q 185,215 230,225
             M 154,250 Q 185,240 230,250
             M 156,275 Q 185,265 230,275"
          stroke="#5c3f10"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.45"
        />

        {/* Beautiful Inside Engraving Lines on the Quran's Right Page */}
        <path
          d="M 350,200 Q 315,190 270,200
             M 348,225 Q 315,215 270,225
             M 346,250 Q 315,240 270,250
             M 344,275 Q 315,265 270,275"
          stroke="#5c3f10"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.45"
        />

        {/* Shiny central binding ribbon / separator */}
        <path
          d="M 248,180 L 252,180 L 252,325 L 248,325 Z"
          fill="#ffea88"
          opacity="0.8"
        />
        <path
          d="M 250,325 L 242,355 L 250,351 L 258,355 Z"
          fill="url(#goldGradient)"
          stroke="#402000"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
