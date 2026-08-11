import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Clock, Send } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SITE_CONTACT } from "@/lib/site-config";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  subject: z.string().min(2, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const contactInfo = [
  {
    icon: MapPin,
    title: "Visit Us",
    details: SITE_CONTACT.address,
  },
  {
    icon: Phone,
    title: "Call Us",
    details: [SITE_CONTACT.phone],
  },
  {
    icon: Mail,
    title: "Email Us",
    details: SITE_CONTACT.emails,
  },
  {
    icon: Clock,
    title: "Hours",
    details: [SITE_CONTACT.hours],
  },
];

export default function Contact() {
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const response = await fetch(buildApiUrl("/api/contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (response.ok) {
        toast({
          title: "Message Sent",
          description: "We'll get back to you as soon as possible.",
        });
        form.reset();
      } else {
        throw new Error("Failed to send message");
      }
    } catch {
      toast({
        title: "Couldn't send message",
        description: "Please try again, or email us directly at " + SITE_CONTACT.emails[0] + ".",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="relative overflow-hidden bg-[#070707] text-white">
          <div className="absolute inset-0">
            <img
              src="/homepage-hero-escalade.jpg"
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: "center center" }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(5,5,4,0.86) 0%, rgba(5,5,4,0.72) 43%, rgba(5,5,4,0.18) 100%), linear-gradient(180deg, rgba(5,5,4,0.10), rgba(5,5,4,0.52))",
              }}
            />
          </div>

          <div className="relative mx-auto grid min-h-[520px] max-w-7xl items-end px-4 py-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-8 lg:py-20">
            <div className="max-w-2xl pb-4 lg:pb-8">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">Contact Golden Luxury Auto</p>
              <h1 className="font-serif text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
                Rental and vehicle management help, handled directly.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/76 sm:text-lg">
                Send the trip, vehicle, owner, or partnership details and the team will route it to the right workflow.
              </p>
            </div>

            <Card className="border-white/15 bg-white/[0.92] shadow-2xl backdrop-blur-md">
              <CardContent className="p-5 sm:p-6 lg:p-8">
                <h2 className="mb-6 text-xl font-semibold text-[#171717]">
                  Send Us a Message
                </h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#171717]">Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your name"
                                {...field}
                                className="border-[#D8D2C3] bg-white text-[#171717]"
                                data-testid="input-contact-name"
                              />
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
                            <FormLabel className="text-[#171717]">Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="you@example.com"
                                {...field}
                                className="border-[#D8D2C3] bg-white text-[#171717]"
                                data-testid="input-contact-email"
                              />
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
                            <FormLabel className="text-[#171717]">Phone (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="+1 (234) 567-890"
                                {...field}
                                className="border-[#D8D2C3] bg-white text-[#171717]"
                                data-testid="input-contact-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#171717]">Subject</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="How can we help?"
                                {...field}
                                className="border-[#D8D2C3] bg-white text-[#171717]"
                                data-testid="input-contact-subject"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#171717]">Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us what you're looking for..."
                              {...field}
                              className="min-h-[160px] border-[#D8D2C3] bg-white text-[#171717]"
                              data-testid="textarea-contact-message"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" size="lg" className="w-full sm:w-auto" data-testid="button-send-message">
                      <Send className="mr-2 w-4 h-4" />
                      Send Message
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-b border-border bg-[#F7F4EC] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            {contactInfo.map((item, index) => {
              const Icon = item.icon;
              return (
                <Card key={index} className="border-[#E2D8BF] bg-white">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-medium text-[#171717]">
                        {item.title}
                      </h3>
                      {item.details.map((detail, i) => (
                        <p key={i} className="text-sm text-[#5D574A]">
                          {detail}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
