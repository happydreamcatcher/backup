I'm going to make professional resume in order to bid on jobs. Here is my resume skeleton and rule of how to structure and make resume. I want you to make the resumes according to this skeleton.
--------------------------- Resume skeleton --------------------------
   0. Head
     Edision Leung
     Senior Software Engineer
    +1 (657)582-3729 • edison.leung.tech@gmail.com • Los Angeles, CA
   1. Summary
   2. Skills
   3. Experience
    - Senior Software Engineer        09/2022 - Present
        Bitcot                                     San Diego, CA
    - Software Engineer II                 01/2020 - 08/2022
        Amazon                                 Seattle, WA
    - Software Engineer                    10/2018 - 11/2019
        United HealthGroup(Optum)  Eden Prairie, MN
   4. Education
      University of California, Berkeley              Berkeley, CA
       Bachelor's Degree of Computer Science  2014 - 2018  
   5. Certifications
     - [Certification Name1] (year)
------------------ The rules for making resume -----------------------
    You must make the resume and cover letter based on this rules. The rules are following:
    1. Summary Section((7 years)
        - In 4 concise sentences, summarize my experience, core strengths, and what makes me a good fit for the role using 80 - 90 words. 
        - Showcase my extensive experience including the project type and project names briefly that I have been participated in last three companies(BitCot, Amazon, United HealthGroup: Never mention company names) combining core 4,5 skills(3 skills in JD, others are related ones).
        - Connect sentences with 3 letter gaps. Don't start in new line if there is gap.
        - Never start or use I(pronoun)
        - create a PGSQL code block containing the content from the Summary section.
        - make keywords bold text.
        - Start with "Experienced senior software engineer with..."
        - Never mismatch when select projects with experience section content projects. one for one company.(Often you forget)
    2. Skills Section
         - At least, skill section must include almost tech stack or skills of JD.   Excepted for JD mentioned Skills, also, plz  understand what related skills are essential or necessary and, mention them even though they are not stated in JD.
           example: as a React frontend job, you can mention following skills(even though some of below skills are not mentioned in JD: this is none other than just one vivid example):
           Styling & UI Technologies: SASS, Tailwind CSS, Styled Components, Material UI, jQuery, AntD, ShadCN UI, Mantine, Chakra UI, Bootstrap
           This is only one example case. The purpose of this is to show hiring managers that I have extensive skills which is either mentioned in JD or not mentioned in JD and also in order to not show I directly tailor my resume to JD. Make sense?
        - The maximum category numbers are 7 or 8. Never make more than 10 categories.(up to 8 is enough) number of skills should be less than 55, greater than 50.
	    - Don't use bullet points.
	    - under category, give me following visual way:
		   Category1 Name(bold font): Skill1, Skill2(all in one line)
		   Category1 Name(bold font): Skill1, Skill2(all in one line)
		   don't hightlight keywords at all.
	    - Give me skill section in  PQSQL code block both (categories should be bold text here too)containing the content from the Skills section. - don't use bullet
	    - outside of code block, mention skills number
    3. Experience Section
		I will provide projects from three companies (BitCot, Amazon, United Health Group). Generate the tailored experiences based on "1) Companies" and use "2) The rules for making Experience" as the guidelines.
	    1) Companies
		    (1) BitCot (This was my last company software consulting company.)
                - Location: San Diego, California	
                - Company overview: BitCot is a San Diego–based software development agency that builds web and mobile apps and increasingly offers AI/automation solutions for startups through enterprises..
	        	 - The projects under industries developed by BitCot:
                   # EdTech:  
                    1. Studio SWEAT onDemand: Digital video fitness platform, blending on-demand classes with social and interactive learning for a global user base
                   #  Real Estate & Construction 
                    2. ASEC Project Suite: Web application for engineering/construction project management—timesheet tracking, reporting, project oversight for geotechnical and environmental firms.
                    3. VAS Engineering Portal: Portal showcasing engineering services, team dashboards, and competitive B2B networking for construction and engineering providers.
                   # Healthcare
                    Temocare TeleHealth: Mobile app for remote healthcare consultations, featuring patient-practitioner video calls, scheduling, data privacy, and report management.
                   # AI
                      CrewAI Assistant: Multi-tasking virtual assistant agent that interacts across HR, finance, or IT systems, adapting responses and workflows based on real-time employee requests
  		    (2) Amazon
			       - Location: Seattle, WA, United States
			       - Company Overview:  Famous Amazon.
			       - The projects developed by Amazon:  
			       # Finance/Fintech
				       **Amazon Payments & Amazon Pay**: Broader payment solutions were improved for merchants and consumers, with integrations into third-party platforms
                   # Healthcare
                     **AWS HealthImaging**: Scalable imaging data management and analysis platform     
                  # AI and Automation
	                  **Alexa Custom Assistant**: A customizable voice assistant for brands and products to develop their own voice experiences.
	              # Retail & Logistics
		              **Amazon Fresh**: a grocery service offered by Amazon that includes both online delivery/pickup options and a chain of physical grocery stores
            (3) United Health Group(Optum).
                - Location: Eden Prairie, Minnesota
			    - Company Overview: Famous UHG and its subsidiary Optum.
                - The projects developed by Optum:  
                   # AI-powered clinical decision support in CareSelect:   "AI-powered clinical decision support" is to enhance healthcare quality and safety by providing clinicians with real-time, evidence-based recommendations during diagnostic test ordering. Its main feature is using advanced AI algorithms—including natural language processing and predictive analytics—to analyze patient data and clinical guidelines to deliver appropriateness scoring and prioritized suggestions directly within the electronic health record (EHR) workflow. This helps reduce unnecessary or low-value testing, supports regulatory compliance (such as CMS requirements), and optimizes patient care decisions. Additionally, it improves clinical workflow efficiency by automatically generating necessary compliance documentation and facilitating smoother prior authorization processes. Overall, it empowers providers to make smarter, data-driven decisions that improve outcomes and reduce costs.        
        2) The rules for making Experience
            - I gave you overviews of past 3 companies and typical products for every company under certain industries. So after understanding JD's requirements, select one product which is similar or relevant to JD's requirements for every company and say I worked on that product dev, then  make sharp and real world sound scenario based on that product overview for every company. Never use product(=project name) which is not listed in company products overview.
              I WANT the project name to appear INSIDE only one bullet for per company, but NOT as a standalone header
            - if JD is fullstack role make fullstack, if backend, then only backend not mention frontend skill, same in frontend role case too.
		    - Mention only AWS services in Amazon.	
		    - When describing the experience, must focus about 80% on the primary programming languages, technology stacks, libraries, frameworks, and tools listed in the job description, and use the remaining 20% to highlight other relevant technologies or skills that strengthen my overall profile. You should mention core language or framework related another libraries or framework too(ex: JD mentions only React, but you should mention also React Native, Next.js. This does not mean you mention React, React Native, Next.js for all companies. plz align them with distributed companies. This is just one example, another->if JD mention Flask, then ok to mention FastAPI, so many examples for this, right? If Java mentioned->Kotlin ok,......)
		    - For every experience bullet, as long as possible, try to make every sentence long between 18 and  24 words so that looks very professional not generic or simple.
		     And every experience bullet sentence must be related to project specific scenario so that sounds like really realistic. not generic.
		    - As long as possible technically, try to mention many core and important skills and keywords mentioned in JD when making experience section bullet points.
            - While relying on the project scope and company overview which I gave you  above , also you must try to  tailor to JD so that I could be best candidate for this position(passing over 95% ATS).  
		    - Use number or percentage so that my experience is qualifiable(20% of bullet points should be qualifiable:). In this case, describe the percentage using "%", not using "percent"
		    - as a last bullet, mention less than 6 core skills which is directly used in corresponding company.
		    - Make 7 experience bullet  for BitCot(senior role) , 7 for Amazon(mid-senior role), and 6 for   United Health Group(Associate role: never lead or mentor others.)
		      These number is calculated except for project name and core skill bullet.
		    - give me experience section in baullet format
	        - Again, create several PGSQL code blocks containing the content from each company in the Experience section. I mean only content without any section labels or extra text(like hyphen or '' etc.).
	          This code block should be placed under above bullet format normal format experience section to see both normal format and PGSQL code block. 
            - Please ensure that each sentence begins on a new line after the previous sentence ends.
	    	- Don't use bullet points  and describe only my experience in PGSQL block, not about company's summary.
	    	- make core skill keywords bold text in PGSQL code block.
		    - Never use "Led ..." if you want to emphasize that kind of leadership skill, use "Played the key role in".
		    - Never use "Scalable", "High performance" like generic sounds words.
    4. Certification Section 
         gimme 5 certifications based on following visual way. Year should be 2024 - 2021(randomly). But sort from larger to lower. All Certifications should be explicitly related to JD's core skills.    gimme in PGSQL code block
          Certification Name1 (year)
	5. Cover Letter Section	
	  Company: Company Name
	  Position: JD: position
	  Date: Today's Date(UTC - 6 timezone)
	  Dear, Hiring Manager
	  [Section to express interest in this position]
	  [Here you must place one line blank]
	  [Section to highlight proficiency in the must-have and nice-to-have skills from the JD, supported by real examples from my resume.]
	  [Here you must place one line blank]
	  [Section to  emphasize achievements that are similar to job mentioned in JD]
	  [Here you must place one line blank]
	  [Section to follow up]
	  Sincerely.
	  Edison Leung
	   - When making the cover letter, you should follow sync btw cover letter and resume(never mismatch) - Dynamically extract and use my real background(companies, teams, projects, and domains) from the attached JD and resume as factual context.
     - Do not invent new companies, projects, or technologies.
    6. Q & A Section
      - After making the resume and cover letter, I sometimes can provide additional questions. When answering those questions,  gimme very human tone answer briefly(4 sentences in most cases), Never use "excited" like buzzwords.
      - Create a PGSQL code block containing the content from the Answer section.
    7. In conclusion
        - I am based in "Los Angeles, CA" and I am a "US citizen". Recently I am going to find only fully remote roles.    And if a job description mentions Public Trust Clearance or any type of security clearance, references intern or junior roles, requires relocation, involves federal or government work, requires travel, includes volunteer positions, specifies hybrid or on-site or in-person work,  then you should stop the process and  tell me reasons and wait for my reply.
          So to begin with everything, at first, JD must pass this filter to make resume, got it?
	    - If JD passes above filter,  start to make resume based on rules in this order.
	       Summary -> Core Skills -> Experience -> Certification->Cover letter
	       before start, plz gimme brief plan to show what languages and frameworks I used for every company, if I agree with that plan, then make resume.
	     Here, you often mismatch projects of summary and experience section. Be cautious.
	    - Never use "—" : long dash in resume,  cover letter and answer.
	    - Please ensure that the headline (including the summary, skills. experience and cover letter sections) is not placed inside any code blocks. These elements should always appear outside of code blocks.
	      In all code blocks, only mention content, no need extra text ex: ''. -. or other letters which is not related to resume directly at all.
	    - It is ok to spend much time, so plz think and think and give me optimized resume content.
	    - Make sense? Just answer yes and then after receiving job description, get started to use your smart ability for my resume.
