/**
 * The blocks of an AITA fact sheet that are not single labelled values, reproduced
 * with the markup the page uses (headings in <h5> or <div>, values as
 * `<p><strong>Label : </strong>value</p>`, and the draws as a table). The people,
 * numbers and addresses are invented: a fixture is committed to the repository, so
 * it must not carry a real person's contact details.
 */
export const FACT_SHEET_SECTIONS = `
<div class="card"><h5>Tournament Information</h5>
  <p><strong>Name : </strong>AITA National Series Tournament</p>
  <p><strong>Country: </strong><img src="x.png"> India</p>
</div>
<div class="card"><h5>Tournament Organization / Venue</h5>
  <h5>Tournament Organization</h5>
  <p><strong>Name of State Association: </strong>Example State Tennis Association</p>
  <p><strong>Association Contact : </strong>A. Contact</p>
  <p><strong>Association Address : </strong>Room 12, Example Stadium, Sample Road, Exampletown</p>
  <p><strong>Association Postal Code : </strong>500001</p>
  <p><strong>Association Phone : </strong>0400000000</p>
  <p><strong>Association Country : </strong>India</p>
  <p><strong>Association State : </strong>Telangana</p>
  <p><strong>Association Email : </strong>association@example.test</p>
  <div>Tournament Director</div>
  <p><strong>Name : </strong>Director Example</p>
  <p><strong>Phone : </strong>9000000001</p>
  <p><strong>Email : </strong>director@example.test</p>
  <div>Referee</div>
  <p><strong>Name : </strong>Referee Example</p>
  <p><strong>Phone : </strong>9000000002</p>
  <p><strong>Email : </strong>referee@example.test</p>
  <p><strong>Certification : </strong>ITF White Badge Referee,</p>
  <h5>TOURNAMENT ACADEMY INFORMATION</h5>
  <p><strong>Name of Academy : </strong>Example Tennis Academy</p>
  <p><strong>Academy Contact : </strong>Academy Contact</p>
  <p><strong>Academy Postal Code : </strong>501504</p>
  <p><strong>Academy Phone : </strong>9000000003</p>
  <p><strong>Academy State : </strong>Telangana</p>
  <p><strong>Academy City : </strong>Exampletown</p>
  <p><strong>Academy Email : </strong>academy@example.test</p>
  <p><strong>Academy Website : </strong>www.example-academy.test</p>
  <h5>VENUE INFORMATION</h5>
  <p><strong>Name : </strong>Example Tennis Academy</p>
  <p><strong>Contact Person : </strong>Academy Contact</p>
  <p><strong>Address : </strong>2-64, Near Sample Gardens,, Sampleville, Samplepura,</p>
  <p><strong>ZIP Code : </strong>501504</p>
  <p><strong>Country: </strong>India</p>
  <p><strong>District : </strong>Telangana</p>
  <p><strong>Mobile No : </strong>9000000003</p>
  <p><strong>Email : </strong>academy@example.test</p>
  <p><strong>Website : </strong>www.example-academy.test</p>
  <h5>Tournament Travel</h5>
  <p><strong>Airport : </strong>Example International Airport</p>
  <p><strong>Train station : </strong>Example Junction Railway Station</p>
</div>
<div class="card"><h5>Event Details</h5>
<table cellspacing="0" cellpadding="0"><thead><tr><th><b>Draws</b></th><th>DrawSize</th><th>Start Date</th><th>End Date</th><th>Sign-In Deadline</th></tr></thead><tbody>
<tr><td>BS18</td><td> Main Draw</td><td> 64 </td><td> 26-10-2026 </td><td> 26-10-2026 </td><td> - </td></tr>
<tr><td></td><td> Qualifying Draw</td><td> 48 </td><td> 24-10-2026 </td><td> 25-10-2026 </td><td> 23-10-2026 18:00 </td></tr>
<tr><td>GS18</td><td> Main Draw</td><td> 48 </td><td> 26-10-2026 </td><td> 26-10-2026 </td><td> - </td></tr>
<tr><td></td><td> Qualifying Draw</td><td> 32 </td><td> 24-10-2026 </td><td> 25-10-2026 </td><td> 23-10-2026 18:00 </td></tr>
<tr><td>BD18</td><td> Main Draw</td><td> 16 </td><td> 26-10-2026 </td><td> 26-10-2026 </td><td> 26-10-2026 12:00 </td></tr>
</tbody></table></div>
<div class="card"><h5>Official Hotel Information</h5>
  <p><strong>Hotel Name: </strong>Example Tennis Academy</p>
  <p><strong>Distance from Venue : </strong>Inside the venue. KM</p>
  <p><strong>Contact Person Name: </strong>Hotel Contact</p>
  <p><strong>Contact No : </strong>+91 9000000004; 9000000005</p>
  <p><strong>District : </strong>Telangana</p>
  <p><strong>City : </strong>Exampletown</p>
  <p><strong>Address : </strong>Samplepura, Sampleville</p>
  <p><strong>Doubles Room Price : </strong>3400.00 INR (Without Tax)</p>
  <p><strong><strong>Breakfast Included </strong>YES</strong></p>
</div>
<div><span>Entry Opens</span><span>11 Aug 2026</span></div>
<div class="card"><h5>Additional Tournament Information</h5>
  <p>Meeting Date &amp; Time :-</p>
  <p>Tournament Information:-</p>
  <p>Example Academy Room Rates</p>
  <p>Room Type (Non-AC)<br>Single: ₹2,800<br>Double: ₹3,400</p>
  <p>Room Type (AC)<br>Double: ₹4,400</p>
</div>
<div><a>Player Login</a><a>Referee Portal</a></div>
`;

/** The same sheet where the organiser left the additional block empty. */
export const FACT_SHEET_BLANK_ADDITIONAL = `
<div class="card"><h5>Additional Tournament Information</h5>
  <p>Meeting Date &amp; Time :-</p>
  <p>Tournament Information:-</p>
</div>
<div><a>Player Login</a></div>
`;

/** A sheet that carries none of those blocks. */
export const FACT_SHEET_WITHOUT_SECTIONS =
  "<html><body><div><h5>Tournament Information</h5><p><strong>Name : </strong>X</p></div></body></html>";
