"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const faqItems = [
  {
    question: "Can I cancel my plan?",
    answer: "Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.",
  },
  {
    question: "What is a workflow credit?",
    answer: "Workflow credits are used to generate videos using our AI workflows. Each workflow (like split screen or Reddit story) uses a certain number of credits.",
  },
  {
    question: "How long is a VEO3 video?",
    answer: "VEO3 videos can be up to 8 seconds long. You can combine multiple generations for longer content.",
  },
  {
    question: "Is VEO3 free?",
    answer: "VEO3 is available on paid plans with a certain number of generations per month based on your subscription tier.",
  },
  {
    question: "How do I view my usage?",
    answer: "You can view your usage in the dashboard under the 'Usage' tab, which shows your remaining credits and generation history.",
  },
  {
    question: "Do you have a refund policy?",
    answer: "Unfortunately, we do not offer refunds. You can cancel your plan anytime and your plan will remain active until the end of the billing cycle.",
  },
  {
    question: "What is an export minute?",
    answer: "Export minutes refer to the total length of videos you can export from the editor each month. This is separate from workflow credits.",
  },
  {
    question: "Can I monetize videos created with Satura?",
    answer: "Yes, you can monetize all videos created with Satura. You own full rights to content you create with our tools.",
  },
  {
    question: "Can I generate in other languages?",
    answer: "Yes, our AI voiceover supports 20+ languages including Spanish, French, German, Japanese, and more.",
  },
  {
    question: "Can I import images from ChatGPT to Satura?",
    answer: "Yes, you can import images from ChatGPT or any other source. Just save the image and upload it to Satura.",
  },
];

export default function FAQs() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10">
          <span className="text-[#9aed00] font-medium mb-2 block">FAQs</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Frequently asked questions
          </h2>
        </div>

        {/* FAQ Accordion - Two columns */}
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="space-y-2">
            {faqItems.slice(0, 5).map((item, index) => (
              <Accordion key={index} type="single" collapsible>
                <AccordionItem value={`item-${index}`} className="border border-gray-100 rounded-xl px-4">
                  <AccordionTrigger className="text-left text-gray-900 font-medium text-sm py-4 hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-500 text-sm pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
          <div className="space-y-2">
            {faqItems.slice(5, 10).map((item, index) => (
              <Accordion key={index + 5} type="single" collapsible>
                <AccordionItem value={`item-${index + 5}`} className="border border-gray-100 rounded-xl px-4">
                  <AccordionTrigger className="text-left text-gray-900 font-medium text-sm py-4 hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-500 text-sm pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </div>

        {/* Still have questions */}
        <div className="bg-gray-50 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Still have questions?</h3>
            <p className="text-gray-500 text-sm">Contact our 24/7 support team for any concerns or inquiries.</p>
          </div>
          <Button 
            onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-[#9aed00] hover:bg-[#8ad600] text-[#1a1240] rounded-full px-6 py-3 text-sm font-bold whitespace-nowrap"
          >
            Get in touch
          </Button>
        </div>
      </div>
    </section>
  );
}
