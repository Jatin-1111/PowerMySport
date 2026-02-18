"use client";

import { useEffect } from "react";

export default function HealthWaiver() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">
            Health, Safety & Liability Waiver
          </h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. Acknowledgment of Risk
            </h2>
            <p>
              You acknowledge that participation in sports, fitness activities,
              and physical training (collectively "Activities") carries inherent
              risks of physical injury, serious injury, permanent disability,
              and even death. These risks include but are not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Sprains, strains, fractures, and broken bones</li>
              <li>Muscle tears and ligament injuries</li>
              <li>Head trauma, concussions, and brain injuries</li>
              <li>
                Cardiovascular incidents (heart attack, stroke, arrhythmia)
              </li>
              <li>Heat-related illnesses (heat stroke, heat exhaustion)</li>
              <li>Dehydration and electrolyte imbalances</li>
              <li>
                Collisions with equipment, venue structures, or other
                participants
              </li>
              <li>Accidents involving falls or loss of balance</li>
              <li>Allergic reactions or medical emergencies</li>
              <li>Pre-existing medical condition complications</li>
              <li>COVID-19 or other communicable diseases</li>
              <li>Other unforeseen injuries or health complications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Assumption of Risk
            </h2>
            <p>
              By booking a sports facility, fitness class, or coaching session
              through PowerMySport, you voluntarily assume all risks associated
              with participation, including risks that may arise from the
              negligence of coaches, facility staff, or other participants.
            </p>
            <p className="mt-3">You agree that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                You are physically fit to participate in the chosen activity
              </li>
              <li>
                You have informed your coach/facility of any medical conditions
                or limitations
              </li>
              <li>
                You have consulted with a healthcare provider if you have
                pre-existing conditions
              </li>
              <li>You understand the physical demands of the activity</li>
              <li>
                You will follow all safety instructions provided by coaches and
                facility staff
              </li>
              <li>
                You accept all risks even if the activity is conducted safely
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Health Declaration
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Medical Fitness Confirmation
            </h3>
            <p>You confirm that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                You are in good physical health and capable of participating in
                sports activities
              </li>
              <li>
                You have no medical condition that would prevent safe
                participation
              </li>
              <li>
                You are not currently under medical supervision for a condition
                that could affect your participation
              </li>
              <li>You are not recovering from surgery or injury</li>
              <li>
                You are not pregnant or dealing with pregnancy-related
                complications
              </li>
              <li>You are not under the influence of alcohol or drugs</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Disclosure Obligation
            </h3>
            <p>You agree to fully disclose to your coach or facility staff:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Any chronic health conditions (asthma, diabetes, hypertension,
                heart conditions, etc.)
              </li>
              <li>Medications you are currently taking</li>
              <li>Allergies (especially relevant to facilities/equipment)</li>
              <li>Recent injuries or surgeries</li>
              <li>Physical limitations or mobility concerns</li>
              <li>
                Mental health conditions that may affect participation (anxiety,
                panic disorders, etc.)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Liability for Non-Disclosure
            </h3>
            <p>
              If you fail to disclose material health information and suffer
              injury as a result:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                PowerMySport, the facility, and the coach are not liable for any
                resulting harm
              </li>
              <li>
                You waive all claims against them for injuries caused by your
                non-disclosure
              </li>
              <li>
                You may be responsible for damages if your non-disclosure causes
                harm to others
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Release & Waiver of Liability
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.1 Comprehensive Release
            </h3>
            <p>You hereby release, waive, discharge, and hold harmless:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>PowerMySport</strong> and its parent company,
                subsidiaries, affiliates, and successors
              </li>
              <li>
                PowerMySport's officers, directors, employees, agents, and
                representatives
              </li>
              <li>The venue/facility owner and their employees and staff</li>
              <li>The coach or trainer and their employees and assistants</li>
              <li>Co-participants and other facility users</li>
              <li>Equipment manufacturers and venue lessors</li>
              <li>
                Any person or entity involved in the organization or execution
                of the activity
              </li>
            </ul>
            <p className="mt-3">
              You release all these parties from any and all claims, lawsuits,
              demands, and causes of action arising from or related to your
              participation in the activity.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.2 Scope of Release
            </h3>
            <p>This release covers:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Injuries and damages resulting from ordinary negligence</li>
              <li>
                Injuries and damages resulting from violations of safety
                standards
              </li>
              <li>
                Medical expenses and hospitalization costs (not covered by
                insurance)
              </li>
              <li>Loss of income due to recovery from injury</li>
              <li>Permanent disability or disfigurement</li>
              <li>Psychological injuries or trauma</li>
              <li>Wrongful death (in extreme cases)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.3 Exceptions to Waiver
            </h3>
            <p>This waiver does NOT cover:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Gross negligence or willful misconduct</li>
              <li>Intentional harm or criminal acts</li>
              <li>Violations of applicable consumer protection laws</li>
              <li>Claims covered by mandatory insurance policies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Insurance & Medical Responsibility
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 Your Insurance Responsibility
            </h3>
            <p>
              <strong>
                You are responsible for maintaining adequate health and personal
                injury insurance.
              </strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                PowerMySport does not provide insurance coverage for injuries
                sustained during activities
              </li>
              <li>
                Your personal health insurance policy (if you have one) is your
                primary coverage
              </li>
              <li>
                You should verify that your insurance covers sports-related
                injuries
              </li>
              <li>
                Some insurance policies exclude certain high-risk activities
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.2 Facility & Coach Insurance
            </h3>
            <p>While facilities and coaches may carry liability insurance:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Their insurance does not automatically cover all injuries</li>
              <li>
                Insurance may not cover injuries caused by your own negligence
              </li>
              <li>
                Coverage limits apply; severe injuries may exceed coverage
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.3 Emergency Medical Response
            </h3>
            <p>In the event of a medical emergency:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Facility staff or coaches may call emergency services
                (ambulance, police, fire)
              </li>
              <li>You authorize this emergency response on your behalf</li>
              <li>
                All medical costs from emergency services are your
                responsibility
              </li>
              <li>
                PowerMySport is not liable for the quality of emergency response
                or treatment
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Acknowledgment of No Medical Supervision
            </h2>
            <p>You acknowledge and agree that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Coaches are not medical doctors and cannot provide medical
                diagnoses
              </li>
              <li>Coaches may offer fitness guidance but not medical advice</li>
              <li>
                If you experience chest pain, severe shortness of breath,
                dizziness, or other serious symptoms, you must stop activity and
                seek immediate medical attention
              </li>
              <li>
                You should not rely on coaches or facility staff for medical
                decisions
              </li>
              <li>
                You should consult with healthcare professionals for medical
                concerns
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Agreement to Follow Safety Rules
            </h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Follow all safety instructions provided by coaches and facility
                staff
              </li>
              <li>Use all safety equipment as directed</li>
              <li>
                Report any unsafe conditions or equipment damage immediately
              </li>
              <li>Not use equipment improperly or engage in horseplay</li>
              <li>
                Not participate if injured, ill, or under the influence of
                substances
              </li>
              <li>
                Exit the activity immediately if you feel unsafe or experiencing
                pain
              </li>
              <li>Respect all facility rules and restrictions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Parental Consent for Minors
            </h2>
            <p>If you are under 18 years old (a "Minor"):</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Your parent or legal guardian must read and sign this waiver
              </li>
              <li>Your parent/guardian accepts all liability on your behalf</li>
              <li>
                You are subject to all parental supervision and safety rules
              </li>
              <li>
                Your parent/guardian takes full responsibility for your medical
                care and emergency response
              </li>
              <li>
                Coaches or facility staff may contact your emergency contact in
                case of injury
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. COVID-19 & Communicable Disease Risks
            </h2>
            <p>
              You acknowledge the ongoing risk of COVID-19 and other
              communicable diseases in group activities:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>PowerMySport cannot guarantee a virus-free environment</li>
              <li>You assume all risks of exposure to communicable diseases</li>
              <li>
                You should follow local health guidelines and get vaccinated if
                eligible
              </li>
              <li>You should not participate if you have COVID-19 symptoms</li>
              <li>
                If you test positive after an activity, notify the facility and
                other participants immediately
              </li>
              <li>You are responsible for any quarantine or isolation costs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold harmless PowerMySport, facilities,
              coaches, and all related parties from any claims, damages,
              lawsuits, or expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your participation in activities</li>
              <li>Your violation of safety rules</li>
              <li>Your failure to disclose health information</li>
              <li>Injuries you cause to other participants</li>
              <li>Damage to facility property caused by your actions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              11. Continued Participation
            </h2>
            <p>
              Your continued participation in any activity after reading and
              accepting this waiver constitutes your explicit consent to all
              terms outlined herein.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              12. Contact & Questions
            </h2>
            <p>
              If you have questions about this waiver or are unsure about
              participating:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Safety Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:safety@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  safety@powermysport.com
                </a>
              </p>
              <p>
                Email (Legal):{" "}
                <a
                  href="mailto:legal@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  legal@powermysport.com
                </a>
              </p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300 bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-red-700 font-bold">
              ⚠️ WARNING: This is a legally binding document. By using
              PowerMySport to book sports activities, you are agreeing to assume
              all risks of injury or death. Do not participate if you have any
              doubt about your ability to safely engage in the chosen activity.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
