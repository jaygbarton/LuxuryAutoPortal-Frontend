import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Bell, Car, Mail, Phone, User } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { type PublicLocation } from "@/lib/location-config";
import { SITE_CONTACT } from "@/lib/site-config";

const locationInterestSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Valid email is required").max(255),
  phone: z.string().max(30).optional(),
  vehicle: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
});

type LocationInterestFormData = z.infer<typeof locationInterestSchema>;

export default function LocationInterest({ location }: { location: PublicLocation }) {
  const { toast } = useToast();
  const form = useForm<LocationInterestFormData>({
    resolver: zodResolver(locationInterestSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      vehicle: "",
      notes: "",
    },
  });

  const onSubmit = async (data: LocationInterestFormData) => {
    try {
      const response = await fetch(buildApiUrl("/api/public/location-interest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          locationId: location.id,
          locationName: location.cityState,
        }),
      });

      if (!response.ok) throw new Error("Failed to join list");

      toast({
        title: "You're on the list",
        description: `We'll notify you when ${location.cityState} is ready for vehicle owners.`,
      });
      form.reset();
    } catch {
      toast({
        title: "Could not submit",
        description: `Please try again, or email ${SITE_CONTACT.emails[0]} directly.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="relative overflow-hidden bg-[#0A0A0A] text-white">
          <div className="absolute inset-0">
            <img src="/homepage-hero-escalade.jpg" alt="" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(6,6,5,0.78) 0%, rgba(6,6,5,0.56) 44%, rgba(6,6,5,0.16) 100%), linear-gradient(180deg, rgba(6,6,5,0.08), rgba(6,6,5,0.46))",
              }}
            />
          </div>
          <div className="relative mx-auto grid min-h-[420px] max-w-7xl content-end px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <Link href={location.path} className="mb-8 inline-flex w-fit items-center text-sm font-semibold text-[#E8B830]">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {location.shortName}
            </Link>
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">
              {location.cityState}
            </p>
            <h1 className="max-w-4xl font-serif text-4xl font-light leading-tight sm:text-5xl lg:text-6xl">
              List your vehicle when this location opens
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
              Add your information to the owner list and Golden Luxury Auto will notify you when this location is active.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
          <div className="space-y-4">
            <Card className="overflow-hidden border-border bg-card">
              <CardContent className="p-0">
                <div className="aspect-video bg-black">
                  <iframe
                    src="https://www.youtube.com/embed/zyhzeXvCp8U?start=1"
                    title="Golden Luxury Auto car sharing program"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="p-5">
                  <h2 className="font-semibold text-foreground">Car Sharing Program</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Watch how Golden Luxury Auto manages vehicles for owners before joining the launch list.
                  </p>
                </div>
              </CardContent>
            </Card>
            {[
              { icon: Bell, title: "Launch Notification", text: `Get notified when ${location.cityState} starts accepting vehicles.` },
              { icon: Car, title: "Vehicle Owner Interest", text: "Tell us what you may want to list so the team can follow up cleanly." },
              { icon: Mail, title: "GLA Follow-Up", text: "Your info goes to the internal launch list for this location." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border bg-card">
                  <CardContent className="flex gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-border bg-card">
            <CardContent className="p-6 lg:p-8">
              <h2 className="mb-6 text-xl font-semibold text-foreground">Join the Vehicle Owner List</h2>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input className="border-white/20 bg-background pl-9" placeholder="Your name" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="email" className="border-white/20 bg-background pl-9" placeholder="you@example.com" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="tel" className="border-white/20 bg-background pl-9" placeholder="+1 (234) 567-890" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Car className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input className="border-white/20 bg-background pl-9" placeholder="Year, make, model" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[140px] border-white/20 bg-background"
                            placeholder="Tell us anything helpful about your vehicle or timing."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                    {form.formState.isSubmitting ? "Submitting..." : "Notify Me"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
}
