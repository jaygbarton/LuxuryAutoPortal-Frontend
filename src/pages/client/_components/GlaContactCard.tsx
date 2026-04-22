import React from "react";
import { Globe, MapPin, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function GlaContactCard() {
  return (
    <Card className="border-border bg-card h-full">
      <CardContent className="p-5 h-full">

        {/* Header: company name + social icons */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="font-bold text-foreground text-base">Golden Luxury Auto:</span>

          <a href="https://www.facebook.com/goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="Facebook">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="#1877F2"/>
              <path d="M16 8h-2a1 1 0 0 0-1 1v2h3l-.5 3H13v7h-3v-7H8v-3h2V9a4 4 0 0 1 4-4h2v3z" fill="white"/>
            </svg>
          </a>

          <a href="https://www.instagram.com/goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="Instagram">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f09433"/>
                  <stop offset="25%" stopColor="#e6683c"/>
                  <stop offset="50%" stopColor="#dc2743"/>
                  <stop offset="75%" stopColor="#cc2366"/>
                  <stop offset="100%" stopColor="#bc1888"/>
                </linearGradient>
              </defs>
              <rect width="24" height="24" rx="5" fill="url(#ig)"/>
              <rect x="7" y="7" width="10" height="10" rx="3" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="2.5" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="17" cy="7" r="1" fill="white"/>
            </svg>
          </a>

          <a href="https://www.youtube.com/@goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="YouTube">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="#FF0000"/>
              <polygon points="10,8 10,16 17,12" fill="white"/>
            </svg>
          </a>

          <a href="https://www.linkedin.com/company/goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="LinkedIn">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="#0A66C2"/>
              <text x="4" y="17" fontFamily="Arial" fontWeight="bold" fontSize="14" fill="white">in</text>
            </svg>
          </a>

          <a href="https://www.tiktok.com/@goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="TikTok">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="#010101"/>
              <path d="M19 8.5a4 4 0 0 1-4-4V4h-2.5v10.5a2 2 0 1 1-2-2 2 2 0 0 1 .5.07V10a4.5 4.5 0 1 0 4 4.5V8.5a6.4 6.4 0 0 0 4 1.4V7.4A4 4 0 0 1 19 8.5z" fill="white"/>
            </svg>
          </a>

          <a href="mailto:goldenluxuryauto@gmail.com" title="Gmail">
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
              <path d="M12 11.2h5.5c.1.5.2 1 .2 1.8 0 4-2.7 6-6.7 6-3.9 0-7-3.1-7-7s3.1-7 7-7c1.9 0 3.4.7 4.6 1.8L13.8 8.6C13 7.9 12 7.5 11 7.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5c2.2 0 3.7-1.2 4.1-2.8H12v-2.5z" fill="#4285F4"/>
            </svg>
          </a>
        </div>

        {/* Contact rows */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            <a href="https://www.goldenluxuryauto.com" target="_blank" rel="noopener noreferrer"
              className="text-sm text-foreground hover:underline hover:text-[#d3bc8d]">
              www.goldenluxuryauto.com
            </a>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">South 500 West, Salt Lake City, Utah 84101</span>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              <a href="mailto:golden@goldenluxuryauto.com" className="hover:underline hover:text-[#d3bc8d]">golden@goldenluxuryauto.com</a>
              {" / "}
              <a href="mailto:goldenluxuryauto@gmail.com" className="hover:underline hover:text-[#d3bc8d]">goldenluxuryauto@gmail.com</a>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              <a href="mailto:cathy@goldenluxuryauto.com" className="hover:underline hover:text-[#d3bc8d]">cathy@goldenluxuryauto.com</a>
              {" (Account Inquiries)"}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
            <a href="tel:18003461394" className="text-sm text-foreground hover:underline hover:text-[#d3bc8d]">
              1-800-346-1394
            </a>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
