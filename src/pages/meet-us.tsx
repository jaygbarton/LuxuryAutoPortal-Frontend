import { BadgeCheck, BriefcaseBusiness, Mail, MapPin, UserRound } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";

const employeeShell = [
  {
    name: "Employee Name",
    role: "Role / Department",
    location: "Salt Lake City",
    note: "Short team bio or responsibility summary will go here.",
  },
  {
    name: "Employee Name",
    role: "Role / Department",
    location: "Salt Lake City",
    note: "Short team bio or responsibility summary will go here.",
  },
  {
    name: "Employee Name",
    role: "Role / Department",
    location: "Salt Lake City",
    note: "Short team bio or responsibility summary will go here.",
  },
  {
    name: "Employee Name",
    role: "Role / Department",
    location: "Salt Lake City",
    note: "Short team bio or responsibility summary will go here.",
  },
];

export default function MeetUsPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EC]">
      <Navbar />
      <main className="public-page pt-20 lg:pt-24">
        <section className="relative overflow-hidden bg-[#0A0A09] text-white">
          <div className="absolute inset-0">
            <img
              src="/gateway-buildings-hero.jpg"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,5,0.92),rgba(6,6,5,0.74)_52%,rgba(6,6,5,0.42)),linear-gradient(180deg,rgba(6,6,5,0.18),rgba(6,6,5,0.82))]" />
          </div>

          <div className="relative mx-auto min-h-[430px] max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">
                Golden Luxury Auto Team
              </p>
              <h1 className="font-serif text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
                Meet Us
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/74 sm:text-lg">
                A shell page for the people who keep GLA moving: operations, fleet readiness,
                guest support, owner care, detailing, and administration.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#E2D8BF] bg-white px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {[
              { icon: UserRound, label: "Team Profiles", value: "Employee bios and photos" },
              { icon: BriefcaseBusiness, label: "Departments", value: "Roles, responsibilities, and coverage" },
              { icon: BadgeCheck, label: "GLA Standard", value: "Trusted people behind every rental" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#171717] text-[#D3BC8D]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#171717]">{item.label}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#5D574A]">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-[#C49000]">Employee Directory</p>
                <h2 className="mt-2 font-serif text-3xl font-light text-[#171717] sm:text-4xl">
                  Team member cards
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-[#5D574A]">
                Placeholder cards are ready for names, titles, profile photos, contact details, and short bios.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {employeeShell.map((employee, index) => (
                <Card key={`${employee.name}-${index}`} className="rounded-md border-[#E2D8BF] bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-5 flex aspect-square items-center justify-center rounded-md bg-[#171717] text-[#D3BC8D]">
                      <UserRound className="h-14 w-14" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#171717]">{employee.name}</h3>
                    <p className="mt-1 text-sm font-medium text-[#7A6B44]">{employee.role}</p>
                    <div className="mt-4 space-y-2 text-sm text-[#5D574A]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#C49000]" />
                        <span>{employee.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#C49000]" />
                        <span>email@goldenluxuryauto.com</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#5D574A]">{employee.note}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
