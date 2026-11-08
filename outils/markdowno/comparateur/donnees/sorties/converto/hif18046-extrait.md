# 1 CHAPTER 1. PREFACE

## 1.1 Background

Over the last few decades significant advances have occurred in the way that bridge engineering analysis *can be* carried out. Engineering practitioners of today, with the aid of ever-advancing computer technology, are able to solve engineering problems of great complexity, and produce designs/evaluations which are more refined and more reliable than in the past. However, our nation’s governing bridge design specifications and the profession as a whole have not yet fully exploited the capabilities of this new generation of engineering design professionals and analytical tools.

The generic term “refined analysis” is often used to describe a more detailed, sophisticated structural modeling approach, which typically involves computerized finite element analysis (FEA). The ability to perform FEA is within the skill set of most engineers today, and software tools are widely available to most engineering firms. *However, “refined analysis” is largely undefined in the design specifications, and is employed loosely and sometimes ambiguously in the specification provisions.* In addition, there is limited guidance in the literature on the proper application of such analytical techniques.

In 2009, an international technology scan entitled “Assuring Bridge Safety and Serviceability in Europe” was sponsored by Federal Highway Administration (FHWA), American Association of State Highway and Transportation Officials (AASHTO), and National Cooperative Highway Research Program (NCHRP). The scan team determined that U.S. engineers need advanced tools and protocols to better assess and assure safety and serviceability of bridges (Hida et al, 2010). The team recommended increased use of refined analysis for bridge design and evaluation, and encouraged the use of refined analysis to avoid unnecessary posting, rehabilitation, or replacement. Unfortunately, practical implementation of these recommendations has been limited.

Many bridge engineers appear to favor a general philosophy of keeping analyses as simple as possible to minimize errors or to remain true to the accepted, proven engineering practices, and consequently have avoided embracing regular use of refined analysis methods. However, this approach, while comfortable, comes at a cost to our nation and may not foster the most effective use of limited resources. The current AASHTO LRFD Bridge Design Specifications feature a reliability-based approach to bridge design, and include formulas for various aspects of load distribution and limit state design with conservatism built in to envelope the limits of applicability and consider all the relevant parameters. Conservatism always adds unnecessary cost, which may have serious implications for owner-agencies with limited budgets.

At the same time, the perceived complexity of the AASHTO provisions encourages designers to focus on developing and using complex automated calculation tools to execute the necessary code checks rather than performing meaningful structural modeling to better understand behavior and address the limit states that are being evaluated. This often hides the controlling factors and hinders the development of new bridge innovations in general.

A properly and efficiently executed refined analysis can provide substantially better information about the state of stress in a bridge and allow for more cost-effective and reliable design.

However, if approached improperly, a refined analysis can involve excessive engineering effort and increased possibility for error. Refined analysis models are often more sensitive to the input parameters and the mathematical assumptions which are employed by the software, and so must be used with care. The engineer must understand the assumptions to ensure correct application. Furthermore, the results of refined analyses can be misleading, making it all the more important that the engineer verify the results by independent calculations. The complexity of the model may make this difficult, so special procedures must be employed to verify accuracy.

The solution to these concerns is to provide standard modeling guidelines and benchmark solutions to guide engineers and provide a consistent set of results for verification, which is the main goal of this manual.

Note that in everyday usage, verify and validate have very similar meanings. However, when it comes to refined analysis, they have different meanings. Verification refers to making sure the analysis is performing correctly, that it is giving the correct results to the input given. Validation refers to making sure that the input is correct, and the results reflect the behavior of the actual structure being modeled.

This manual was developed to provide guidance to bridge engineers regarding the use of finite elements as a refined analysis method for designing or evaluating typical concrete deck slab on girder highway bridges. Complex structure types, such as cable stayed, suspension, or arch bridges are not specifically addressed. The AASHTO LRFD Bridge Design Specifications (AASHTO LRFD) (AASHTO, 2014) allow for many different types of analysis, but generally only provide detailed guidance on the application of approximate methods, such as distribution factors for right straight multi-girder bridges, leaving the details of refined analysis up to the bridge design engineer. When a structure falls outside the limits of applicability of an approximate method, AASHTO LRFD essentially requires refined analysis without providing much guidance as to how it should be carried out.

## 1.2 What is Refined Analysis?

Refined analysis often means different things. A definition of refined analysis is needed to explain more clearly what this manual addresses. Perhaps a good way to define what something is, is to start with what it is not. By noting where the AASHTO LRFD states “in lieu of a refined analysis…,” an idea of what is not considered refined analysis can be developed. This would include:

- Line girder analysis using distribution factors
- Single step moment magnification procedure for compression elements
- Curved spine beam analyses
- Strut and tie models of concrete elements
- Strip method of deck analysis and design
- Cross-sectional frame analysis for box girders
- V-load for curved I-girder bridges
- M/R method for curved bridges
- Equations for effective flange width of composite decks

Having listed some of what refined analysis is not, a definition of what refined analysis might include can begin to be constructed. *A refined analysis might:*

- *Account for shear lag in deck and planar elements*
- *Account for the distortion of a cross-section*
- *Explicitly model cross-frames*
- *Explicitly model the deck as a plate (rather than a grid) in two dimensions*
- *Distribute load to girder lines based on interconnecting stiffness*
- *Assess capacity through the use of plastic hinges, such as by pushover analysis.*

Refined analyses are more sophisticated, and when correctly applied, generally more accurate than the current approximate methods contained in the AASHTO Specifications.

## 1.3 Why use a Refined Analysis?

In some cases refined analysis is *required* to complete the design according to AASHTO LRFD. These are instances for which the specification approximate methods do not apply. *Furthermore, there are reasons why using a refined analysis might be advantageous, including but not limited to:*

- *Capturing behavior not adequately accounted for by approximate methods and/or outside the limits of the Specifications. Even within the limits of applicability, approximate methods can give erroneous indications of a structure’s true behavior.*
- *Obtaining more accurate, and less conservative, demands for existing structures, especially when approximate methods result in conservative demands which in turn result in extensive repair or replacement of structures.*

The potential payoff for widespread implementation of refined analysis in the bridge engineering industry is considered broad, but difficult to quantify. This Manual promotes a fundamental change in the practice of bridge engineering and attempts to move our industry past the use of simplistic design specifications to achieve more optimal solutions. It can be said that if merely one bridge is saved from replacement by the application of refined analysis in an evaluation, then any additional engineering effort is justified. If only five percent material savings could be realized in every new design across the nation, then potential savings in taxpayer money would easily be in the tens of millions of dollars *every year*.

Practitioners indicate that refined analysis of most bridge structures can be done for only a small premium over conventional, simplified techniques with currently available computer technology. The practice of bridge engineering in the future is expected to take a more holistic approach, where the design, fabrication, construction, inspection, and management will be much more integrated by digital information exchange. Refined analysis is expected to become routine as software vendors develop “translator” and “wizard” tools to communicate with database records and generate detailed structural models for engineering analysis. This Manual is seen as an essential component to defining proper criteria for software vendors to follow and for engineers to demand from their tools.

Refined analysis in bridge engineering has the potential to provide the following benefits in the engineering design and evaluation of our nation’s infrastructure:

- Improved structural safety by more rigorous assessment of limit states
- Increased economy by going beyond use of approximate, conservative design formulae
- Increased safety and economy by accurate modeling of system or local behavior
- Improved safety evaluation by full consideration of condition data such as section losses or as-built geometry
- Increased sustainability by more frequent salvaging of existing infrastructure
- Accelerated innovation development as industry gains deeper understanding of bridge behavior

Note that while a general theme of the reasons for refined analyses is greater design economy, there are also cases where refined analysis does not result in savings, but an improved, more uniform level of safety, by providing deeper insight into actual structural load paths. An example would be where an element carries a greater percentage of total load than adjacent similar elements, and designing them all for an average load would lead to a higher probability of progressive failure.

## 1.4 Evolution of Structural Analysis Methods

Structural mechanics has its roots in the mid-nineteenth century. Over the next several decades numerous “classical methods” of structural analysis were developed, including Castigliano’s 1st and 2ndtheorems, slope-deflection, three moment equation, conjugate beam, moment area, virtual work, moment distribution, and many others. In general, a linear analysis technique needs to satisfy equilibrium, compatibility, and the stress-strain relationship of the component material(s). Some classical methods solve specific geometrical problems, while others have more general application.

Matrix algebra also has its roots in the same time period in the mid-nineteenth century. But it wasn’t until about 1930 that the aerospace industry started to develop modern matrix methods of structural analysis (Felippa, 2001). There are essentially two matrix analysis techniques, the compatibility, or flexibility method, where the unknowns are forces, and the equilibrium, or stiffness method, where the unknowns are displacements. For about the next 30 years matrix methods were simply another tool for performing structural analyses, along with the numerous classical methods, due to the limitations of the “human computers” and the calculating devices such as the slide rule or mechanical calculators available to them. The required solution of simultaneous equations, often by matrix inversion calculations for structures involving more than a handful of members, quickly became unwieldy. The flexibility method, which required selection of appropriate redundant force patterns, was embraced by the aerospace industry, as the selection of redundants for the lattice skeleton of aircraft was well understood, resulting in simpler solutions to the problems they faced.

In 1951, the first electronic commercial computers, the UNIVAC1, were manufactured. Although much too expensive for the average consultant design office, early computers represented a gigantic leap forward in calculating power. Throughout the 1950s what were eventually referred to as “mainframe” computers continued to be developed. In the late 50s, the FORTRAN programming language was developed making it much easier to program the computers to solve scientific and engineering problems. Then, in 1959, M. J. Turner, head of the Structural Dynamics Unit at Boeing and an expert in aeroelasticity, presented the first paper on

the Direct Stiffness Method (DSM) (Felippa, 2001). R. W. Clough coined the term Finite Element Method in a paper authored in 1960 (Clough, 1960) which eventually replaced DSM by about 1965 as the terminology for the analysis method.

For the DSM, element stiffness matrices are generated in local reference systems, then transformed to a global reference system and directly assembled together to create the overall structure stiffness matrix. The assembly method is insensitive to element type and works no matter how many nodes comprise an element. This allows the programs to easily accommodate essentially unlimited additions of new types of elements as they are developed. The analysis method is linear elastic and small deflection, since the matrices are assembled based on initial geometry and elastic properties and remain unchanged throughout the analysis, but nonlinear problems could be solved iteratively using a series of linear steps by revising the stiffness matrix at the beginning of each step.

The DSM was perfectly suited for solving general boundary value problems using digital computers. But general purpose direct stiffness finite element programs did not develop overnight. Even though computers were becoming more powerful and were being acquired by more design offices, early computerization consisted mainly of custom automating the classical methods that were in use at the time, which generally limited the solutions to specific problems or geometries. Not to mention that the aerospace industry still was invested in the flexibility method. By about 1970, however, the DSM had carried the day, and become the standard solver technique for what we know today as general purpose finite element programs.

One of the first matrix structural analysis packages available to bridge design engineers was “STRESS,” for STRuctural Engineering System Solver, developed by S. J. Fenves and others at M.I.T. and supported on the IBM 1130, a powerful and relatively inexpensive computer marketed in the mid 1960s. This line element software enabled engineers to solve systems of two- and three-dimensional truss and beam elements. The key difference between this software and the custom written programs of the time was that this program could solve problems of any geometrical configuration. Using this program bridge designers were able to analyze multi-girder bridges using grillages or space frames to arrive at a system solution rather than rely on approximate distribution factors.

Programs such as STRESS, written to solve static first-order problems, soon were used by creative engineers as a calculation engine to compute trial and error deflections necessary to use iterative methods such as the Newmark process for calculating frequencies, mode shapes, buckling loads, and second order deflected shapes of relatively complex structures. Engineers used their understanding of structural theory and structural behavior to overcome the hardware and software limitations of the time. This continues today, for instance an equivalent Saint- Venant torsional constant can be used to account for warping, an effective modular ratio can be used to adjust section properties to account for concrete creep under sustained loads, or an effective stiffness is used to approximate cross frame behavior with a single element.

In the 1970s general purpose finite element programs started to become more widely available to design engineers in the form of programs such as NASTRAN, SAP, and STRUDL. These packages added enormous analytic capabilities to the engineer’s tool kits. Element libraries contained not only beam and truss elements, but plate bending elements, shell elements, and plane-stress and plane-strain triangles and quadrilaterals as well as three-dimensional brick

elements. This enabled engineers to solve continuum-type three-dimensional problems with relative ease.

Over the last 40+ years there have been many advances in the capabilities of finite element analysis (FEA) programs including:

- Improvements in pre-processing o Graphical user interfaces (GUIs) o Large element libraries o Model generation wizards/automatic model generation
- Improvements in solver capabilities o Multiple solver choices depending on model/elements o Matrix optimization o Non-linear iterative capabilities
- Improvements in post-processing o Report generation o Stress visualizations o Animations

It should be noted that most of these advances are essentially “bells and whistles” for improving speed and user-friendliness. The DSM of the 1970s continues to be the standard solver technique in use today. The main advantage of the programs of today over those of yesterday is the increase in computing capacity. Structures can be modeled and analyzed today in a day that would have taken weeks to run 40 years ago, if they could have been analyzed at all. Furthermore, it is expected that structures which engineers would never attempt to model today, will be easily modeled and analyzed in the future.

## 1.5 State of Practice

The standard method of analysis for typical multi-girder bridges in the United States has for years been a line girder analysis with the use of distribution factors. In this type of approximate analysis, each girder is analyzed as a stand-alone component. Assumptions are made regarding the distribution of dead loads among the girders, while distribution factors account for the transverse distribution of live loads. If the bridge is continuous, or otherwise indeterminate, an analysis program is usually used to determine the shears and moments in the girders based on the distributed loads applied.

There are many advantages to this approach to bridge analysis, among them ease of use and repeatability of results. However, there are some disadvantages, not the least of which is the limited range of applicability. The method begins to break down when the bridge becomes skewed and/or curved. In these cases, the cross-frames between girders become part of the primary load resisting system, and accounting for them in the analysis requires additional approximate calculations such as the V-load method, or M/R method for curved bridges. The accuracy of these approximations degrades as the degree of skew and/or curvature increases.

Also, even for straight non-skewed structures, use of AASHTO LRFD distribution factors tends to introduce a degree of conservatism that usually results in more total design live load than lanes on the bridge, and the use of more material in the design than necessary. Using refined analysis

to distribute the live load more accurately has the potential to provide more economical new bridges and/or improved load ratings for existing bridges.

The trend in refined analysis has been a decreasing additional cost in time and effort versus traditional approximate methods. Developments in available software continue to decrease the differential analysis cost such that this will not be a significant factor in the decision of which method to use in the very near future, if in fact it has not already occurred for some classes of structures.

In the United States, certain bridge types have been designed using refined methods of analysis for at least 40 years. In fact, approximately in 1988, when the framework for the AASHTO LRFD was developed, the development team proposed to the Panel guiding the work that distribution factors not be part of the Specifications, but rather that the requirement would be a two- or three-dimensional refined analysis. At the time this suggestion was roundly rejected as beyond the capability of most practicing engineers. Now many more practicing engineers have had some education and/or experience with the refined methods of analysis, computer programs to perform such analyses are more widely available, and the computing power required to run them is easily affordable*. Currently, for most cases of design of concrete deck slab on girder highway bridges, a 2-D plate on eccentric beam (PEB) would be the recommended refined analysis procedure* (for more on PEB see Sections 2.4.3.2 and 3.5.2).

Modeling issues, in particular boundary conditions and loading, are sources of problems in the application of refined methods such as FEA, not to mention that different acceptable models can yield somewhat different results. It is not the purpose of this manual to legislate the use of models for particular types of bridges, but to direct the engineer in developing reasonable models which will produce more consistency in the application of these refined methods. This is particularly true for bridges with complex geometry such as curved and skewed bridges in which the quantification of the forces and distortions in some of the members cannot be accurately predicted with the approximate methods for load distribution in Section 4 of the AASHTO LRFD. This is why references are made at various places within the specification as to when refined methods are particularly appropriate.

## 1.6 Scope of Manual

The approach presented by this manual is to relate refined analysis techniques to those currently addressed in the AASHTO LRFD, to highlight what an engineer needs to consider when moving to a refined analysis, and to ground the process in basic engineering fundamentals and practical, experience-based guidelines. Guidance on the applicability of one-, two-, and three-dimensional analysis are provided. References to specific proprietary software packages are avoided if possible.

Also addressed are some of the unique issues of analyzing existing structures, such as the need to know the construction method and sequence in order to properly account for the distribution of dead load and locked-in stresses. For example:

- A girder bridge erected as simply supported for dead load but made continuous for live load.
- Segmental concrete girders erected by the cantilever method acting like cantilevers for dead load but continuous girders for live load.

It is not the aim of this manual to cover material that can be found in other existing publications. A partial list of publications that supplement/extend the information presented here are:

- NCHRP Report 725 – Guidelines for Analysis Methods and Construction Engineering of Curved and Skewed Steel Girder Bridges
- NCHRP Report 620 – Development of Design Specifications and Commentary for Horizontally Curved Concrete Box-Girder Bridges
- AASHTO/NSBA Steel Bridge Collaboration – G 13.1 Guidelines for Steel Girder Bridge Analysis, 2ndEdition
- FHWA Orthotropic Deck Design Manual
- NHI Course No. 130095 – Analysis and Design of Skewed and Curved Steel Bridges with LRFD – Reference Manual
- NSBA Skewed and Curved Steel I-Girder Bridge Fit (Chavel et al., 2016)
- FHWA Post-Tensioned Box Girder Design Manual (Corven, J., in development)

Throughout the following chapters, references to the seven examples developed as part of this manual are included. These examples are provided in Chapter 9. The seven examples include four general bridge analysis examples:

(1) Example 1 - a straight, three-span, composite precast concrete I-girder concrete deck slab bridge with square supports, simply supported for dead load made continuous for live load; (2) Example 2 - a straight, three-span continuous, composite steel I-girder concrete deck slab bridge with square supports; (3) Example 3 - a curved, three-span continuous, composite steel I-girder concrete deck slab bridge with skewed supports; and (4) Example 4 - a curved, three-span continuous, concrete box girder spine beam.

Also provided are three more specifically targeted examples on more advanced topics:

(5) Example 5 - a dynamic linear multimode response spectra analysis of the curved multi-girder steel bridge from Example 3 including soil structure interaction, pushover, and dynamic deflections; (6) Example 6 - a stability analysis of a tall concrete pier incorporating geometric nonlinearity and utilizing cracked/uncracked section properties where appropriate; (7) Example 7 - a staged, construction analysis of a four span 660’ long continuous concrete box girder bridge with external tendons, focusing on global design forces including concrete creep and shrinkage.

Multiple methods are used in the examples in order to compare the results of increasing refinement in the analyses.

## 1.7 Summary

To support advancement in the practice of bridge engineering in the U.S., this Manual provides guidelines and examples for the proper use of refined analysis in bridge engineering. The expected outcome is a move toward widespread use of more refined, modern analytical techniques to improve economy, safety and performance of our nation’s infrastructure now and in the future. Some engineers may be uncomfortable moving away from the predictable and conservative load distribution factor method of design to refined methods that result in potentially lower and more variable design force effects. However, as long as the refined model is representative of the designed structure, the target Reliability Index of the AASHTO LRFD Design Specification will still be obtained. In other words, the design will still satisfy the intent of the Specifications, meeting all limit states and achieving constructability, safety, and serviceability, through use of a more efficient design with less conservatism.

To achieve this goal, this manual strives to provide sound technical guidance, but to not overly constrain designers. Often there is more than one valid path to correct results, while there are certainly also potential pitfalls leading to incorrect results. The intent of this manual is to educate engineers, making them more aware of both the pitfalls and valid paths, without prescribing an overly restrictive approach to refined analysis.

This manual provides guidance on the following topics:

- *Reviewing the basics of the finite element method.*
- *Choosing the appropriate level of refinement, i.e. 1D, 2D, or 3D model for the problem at hand.*
- *Assembling the chosen model(s), including element types, meshing, and boundary conditions.*
- *Loading the model(s) in accordance with the AASHTO LRFD Specifications.*
- *Verification/Validation of both the model and loading.*
- *Extraction of usable results.*

Preventing misuse of the FEA method, while maximizing flexibility so designers can choose the most appropriate implementation for the structure and client at hand, is the goal. The manual is written such that a bridge engineer who has just received licensing as a professional engineer, and is familiar with the general aspects of bridge design and analysis, but who may not have had much exposure to the finite element analysis method as applied to bridges, can utilize it to perform routine bridge analyses. Important concepts are highlighted using *italics*. Some advanced topics are also provided for more experienced engineers to help in performing more sophisticated refined analyses.

Once the model has been assembled and the program run, various outputs are generated. Load cases can often be combined and factored within the programs if desired. Note that factored combinations are only appropriate in cases where superposition is valid, such as linear elastic analyses, and not for nonlinear results. Usually all of the outputs can be viewed graphically as well. It is suggested that the deflected shape and reactions be examined initially. Often errors can be easily identified when the model deflects or reactions are distributed in unexpected ways. Other typically utilized outputs are forces and/or stresses. These can usually be viewed as graphs or contours, or exported in the form of tables for further post-processing. Note that outputs are not always in a form that can be directly utilized for AASHTO LRFD (see Chapter 8 for more on utilizing analysis results).

# 2.3.4 Typical Element Families and Usage

There are four typical element families used in bridge design: Point, line, surface, and volume. There are many elements with different formulations, different capabilities, and different DOF within each family of elements. They range from specialty elements with very specific application, to more generic elements with more general application. Constraints and rigid links are arguably a fifth class of elements. Constraints and rigid links can provide appropriate connectivity within a model, such as composite action. It is the user’s responsibility to make sure the elements comprising a model are compatible and have the appropriate DOF and capabilities for the problem at hand.

*2.3.4.1 Point Elements, Constraints, and Rigid Links*

Point elements are zero, or near zero, length elements which interconnect other elements in a model, usually at coincident nodes. Point elements are often used between elements to release certain degrees of freedom. Point elements can also be used to provide linear or nonlinear support conditions, to add a point mass for dynamic analyses, or to connect multiple nodes by springs with translational and rotational stiffness. Some FEA packages have interface point elements that can be used for instance as tension only, or contact elements, or in between layers of composite materials.

Point elements are not typically used in models for routine slab-on-girder bridge design, but may be utilized to model bearings using releases or spring stiffnesses between superstructures and substructures within a model.

Constraints and rigid links are methods of constraining or releasing the movement of geometric or nodal freedoms within a model. They can be used to set up a relationship between nodal freedoms, maintaining defined compatibilities. Often, they are preferable to using stiff elements when connecting nodes rigidly, as overly stiff elements can result in solver errors due to an ill-conditioned stiffness matrix. They also allow the flexibility of constraining any combination of the six DOF at a node.

*2.3.4.2 Line Elements*

Line elements are used to model bars, beams, cables or other structural elements where the length of the element is generally much greater than the depth and the width. For line elements, transverse through-thickness normal stresses are negligible, with normal stresses generated only along the longitudinal axis of the element. Line elements are attractive for use in bridge design,

as the forces typically used for bridge component design; axial forces, bending moments, and shear forces, are directly output.

2.3.4.2.1 Bar or Truss Elements

Bar or truss elements are two-force members capable of resisting deformation only in the longitudinal member direction (see Figure 3). This resistance is associated with axial force in the member. This type of element is used where members are subjected to primarily axial forces, such as trusses or cross-frames. In some programs, bar elements are a special case of a beam element, with all rotational degrees of freedom released. Some programs allow tension only or compression only bar elements.

> **Figure 1** · image · p. 11 : Figure 3. Illustration. Bar or truss element.
>
> *texte de l'image non extractible du PDF : voir l'image*

2.3.4.2.2 Beam Elements

Depending on the element formulation, beam elements can have stiffness and transmit loads corresponding to all six DOF at each node as illustrated in Figure 4. Beam elements are therefore capable of modeling components that resist not only axial forces but also biaxial shear, biaxial moment, and torsion. Most programs allow the release of individual DOF such that elements with any combination up to six DOF at each node are possible. Beam section properties can also be manipulated to effectively release DOF. There are two formulations of beam elements, Euler-Bernoulli beam elements and Timoshenko beam elements. The formulations for these two types of elements can be found in various texts, including (Hughes, 2012).

> **Figure 2** · image · p. 11 : Figure 4. Illustration. Beam element.
>
> *texte de l'image non extractible du PDF : voir l'image*

Euler-Bernoulli beam elements are typically used when capturing deformation due to shear is not required. Shear deformation is generally negligible in cases where the span to depth ratio of the beam is greater than about 8. For most cases, modeling bridge girders using this type of beam element will produce satisfactory results.

Timoshenko beam elements are capable of capturing shear deformation. This element should be used when shear deformations are not negligible. An effective shear area must be provided in the section properties in order to formulate the Timoshenko beam element shear stiffness matrix. The effective shear area corresponds to the area for which the strain energy from a uniform shear stress equals the strain energy that would be present in the non-uniform shear stress of the beam shape being analyzed.

The effective shear area of a section depends on the shape of the section, but is always smaller than the cross-sectional area in a given plane, such as the approximation using the area of the web rather than the total cross-sectional area as the effective shear area for wide flange beams loaded about the strong axis. Effective shear areas of common shapes such as those listed in Table 1 are often provided in FEA program manuals, but can also be found in some reference books. A general treatment for calculating the effective shear area is found in (Meek, 1971), or a section property calculator can be utilized to find the effective shear area of a given shape.

**Table 1. Effective shear areas of common shapes.**

| Description | Effective Shear Area |
| --- | --- |
| Solid Rectangular Section – dimensions b x d | 5/6 bd |
| Thin-walled Hollow Rectangular Section | 2 tD |
| Solid Circular Section | 0.9 πR² |
| Thin-Walled Hollow Circular Section | πRt (=A/2) |
| I-beam (along web direction) | Aweb |
| I-beam (along flange direction) | Aflanges |
| No Shear Deformation | 1000A\* |

Note: In some programs a value of zero for the shear area results in shear deformations being neglected. Consult the software user manual for more information.

*Although using Euler-Bernoulli beam elements for girders is generally sufficient, using Timoshenko beam elements will generally provide more accurate results, with little increase in computational effort, no difference in the mesh, and no increase in the amount of output data*. Timoshenko beam elements should always be used when shear deformations are not negligible, such as when modeling short deep members or when large concentrated loads are applied close to a support. In general, a reasonable shear area must be assigned to Timoshenko beam elements to achieve valid results, although in some programs assigning a value of zero to the shear area results in shear deformations being neglected.

Most current finite element beam element formulations include only the Saint-Venant torsion while ignoring the warping torsion because the available six degrees of freedom can only accommodate planar behavior. Some programs may include beam element formulations which include a seventh degree of freedom to allow inclusion of warping torsional stiffness directly.

*2.3.4.3 Surface Elements*

Surface elements such as plates and shells are used to model situations where the thickness is generally much less than the dimensions of the other two orthogonal directions. The main difference between plates and shells is that shells include axial membrane stresses in the plane of the elements, as well as the bending and shear stresses carried by plate elements. Figures 5 and 6 show a plate and a shell element respectively. The shell element includes the membrane forces indicated by sx,m and sy,m.

> **Figure 3** · image · p. 13 : Figure 5. Illustration. Plate element. Figure 6. Illustration. Shell element.
>
> *texte de l'image non extractible du PDF : voir l'image*

> **Figure 4** · image · p. 13
>
> *texte de l'image non extractible du PDF : voir l'image*

Surface elements are generally modeled as triangles or quadrilaterals as illustrated in Figure 7. Quadrilaterals are typically used for the regular shaped areas in finite element analysis of bridges though triangles may be used, especially for transition meshes and irregular shapes. Usually some minimal out-of-flatness is tolerable, as is having curved edges when a midside node is present. For more information on out-of-flatness for surface elements, see (Cook, 2002).

> **Figure 5** · image · p. 13 : Figure 7. Illustration. Typical surface element geometries.
>
> *texte de l'image non extractible du PDF : voir l'image*

Finite element software sometimes offers the choice between Kirchhoff-Love formulation plates or shells and Mindlin-Reissner plates or shells. The difference between Kirchhoff-Love and Mindlin-Reissner surface elements is similar to the difference between Euler-Bernoulli and Timoshenko beam elements as described in Section 2.3.4.2.2. Mindlin-Reissner elements include through thickness shear deformations, while Kirchhoff-Love elements do not.

The Mindlin-Reissner shell formulation is recommended in general because it tends to be more accurate, even for thin shell bending problems in which shear deformation is negligible. *As with beam elements, including shear deformations will almost always provide more accurate results if modeled correctly, with little increase in computational effort, no difference in the mesh, and no increase in the amount of output data*. When the mesh is coarse, and shear deformation is negligible, Mindlin-Reissner elements tend to be slightly stiffer than Kirchhoff-Love elements. When the mesh is sufficiently fine, the Mindlin-Reissner elements tend to be more flexible than

# 2.5 Refined Methods of Analysis and Reliability

Two issues arise regarding refined analysis and reliability: the impact of using refined analysis instead of distribution factors on the calibration of the AASHTO LRFD Specifications, and *the effect on achieved reliability for a bridge designed using refined analysis*. The AASHTO LRFD Specification live load and resistance models were calibrated to achieve a target reliability utilizing the calculated distribution factors in the specification. If a refined analysis such as 3D finite element analysis (FEA) or plate and eccentric beam (PEB) grillage analysis is used resulting in different load effects and different size design sections, a different reliability will be realized. The following sections explore the effects of refined analyses on the design reliability indices, and what, if anything, should be done about it.

# 2.5.1 Evaluation of the LRFD Reliability Index

In the case of the resistance, R, and the load effect, Q, both being normal random variables and satisfying certain limits on the sizes of their coefficients of variation, COV’s, the reliability index, β, can be calculated using Equation **(2)**:

> **Figure 6** · image · p. 14
>
> *texte de l'image non extractible du PDF : voir l'image*

**(2)**

where: *R* = mean or expected value of the resistance

*Q* = mean or expected value of the load s*R* = standard deviation of the resistance s*Q* = standard deviation of the load

This equation is a simple expression for the reliability index and can be used to make qualitative assessments of the effect of varying the method of analysis of live load. The actual calibration equations used in the development of AASHTO LRFD, based on the Rackwitz and Fiessler (1978) procedure, were more complex, more general and subject to fewer limitations than the equation presented here. They are treated further in Nowak (1999) and Kulicki et al. (2007).

The quantitative assessment of the effect of varying the method of analysis of live load presented here was developed using the same process used in the development of AASHTO LRFD. It is worth noting that modern calibration calculations usually use the Monte-Carlo method. A comparison showed that the Monte-Carlo method applied to the full set of bridges used in the LRFD calibration gave virtually identical reliability indices determined during the original calibration of AASHTO LRFD (Kulicki et al., 2007).

In specification calibration it is common to assume that the provided resistance of sample bridges exactly satisfies the code requirements. Using this assumption enables the sum of the specified factored loads to be used instead of calculating the resistance of sample bridges. The loads represented by Q in the reliability equation are statistically projected based on nominal loads, biases and coefficients of variation. The live load is based on extrapolating measured data to the design life which is 75 years in the case of AASHTO LRFD. Another assumption inherent in the calibration is that the analysis doesn’t introduce any shifts in the bias factors, or otherwise affect

the load and resistance distributions, i.e., it’s a perfect mapping from load (probabilistic and notional) to force effects.

# 2.5.2 Effect of Refined Analysis on Calibration

Several cases are presented to illustrate the effect of changing the method of analysis used in AASHTO LRFD on the calibration. *The qualitative difference in the reliability index is deduced from the reliability equation and a quantitative assessment is illustrated for a representative sample of bridges from the original LRFD calibration*.

Case 1 – Design by Simplified Methods: Design with 7th Edition of AASHTO LRFD. This is the base case. Quantitative results are shown in Table 2 for comparison to the remaining cases.

Case 2 – Design by Refined Analysis: Design with simulated refined analysis results assumed to be 80 percent of the values from AASHTO LRFD girder distribution factors for both load and resistance. This illustrates assuming that the refined analysis yielded 80 percent of the live load moment that the distribution factors yield. In terms of calibration, analysis is a mapping of both the probabilistic load model (load), as well as the notional loading (resulting in a provided resistance), to design effects such as moment and shear. For this case, the assumption is that the refined analysis is used to calculate the effects of the probabilistic load model and the notional load model.

These changes would affect both R and Q in a similar way in the reliability equation so the differences compared to the base case would be expected to be small. This is confirmed in Table 2 by comparing the reliability indices for Case 1 and Case 2. There are slight differences because the factored HL93 loading, while trend-wise similar to the projected live load, is not identical to it. Additionally, there are statistical factors applied to the projected live load.

Case 3 – Evaluation by Refined Analysis for Load Effects: Design (provided resistance) based on the AASHTO LRFD including the use of the current specification supplied distribution factors but the projected live load on the load side was based on simulated refined analysis assumed to yield 80 percent of results from AASHTO LRFD girder distribution factors. This simulates an AASHTO LRFD design evaluated by refined analysis of HL93 loading. Considering the reliability equation it would be expected that since Q is decreased by use of the reduced distribution factors, the reliability indices in the case should be higher than Case 1. This is confirmed in Table 2.

**Table 2. Comparison of reliability indices.**

<table>
<tr><th colspan="3">Bridge Properties</th><th colspan="3">Reliability Index</th></tr>
<tr><td>Girder Type</td><td>Span (ft)</td><td>Spacing (ft)</td><td>Case 1</td><td>Case 2</td><td>Case 3</td></tr>
<tr><td>Prestressed Concrete</td><td>60</td><td>8</td><td>3.76</td><td>3.76</td><td>4.96</td></tr>
<tr><td>Prestressed Concrete</td><td>60</td><td>12</td><td>3.75</td><td>3.75</td><td>4.94</td></tr>
<tr><td>Prestressed Concrete</td><td>120</td><td>8</td><td>3.64</td><td>3.55</td><td>4.26</td></tr>
<tr><td>Prestressed Concrete</td><td>120</td><td>12</td><td>3.64</td><td>3.56</td><td>4.27</td></tr>
<tr><td>Composite steel</td><td>60</td><td>8</td><td>3.71</td><td>3.70</td><td>4.74</td></tr>
<tr><td>Composite steel</td><td>60</td><td>12</td><td>3.71</td><td>3.69</td><td>4.69</td></tr>
<tr><td>Composite steel</td><td>120</td><td>8</td><td>3.58</td><td>3.51</td><td>4.12</td></tr>
<tr><td>Composite steel</td><td>120</td><td>12</td><td>3.55</td><td>3.47</td><td>4.05</td></tr>
</table>

The results are as would be expected:

- Since the analytical method used in calibration shows up on both sides of the calibration equation in Case 2, it has little impact on the results compared to the base case;
- When more conservatism than used in calibration is present in the design, either through live load distribution factors as assumed in Case 3, or through design resistance, the Reliability Index increases compared to the base case.

# 2.5.3 Effect of Refined Analysis on Achieved Reliability

The question that may be most relevant to the use of refined analysis in bridge design is: How does the use of refined analysis during the design phase of a bridge impact the safety of the constructed bridge? Clearly, if the method of analysis used results in less material in the structural members, and thus lower resistance, there has been a change in the level of reliability provided. In order to explore this issue, the difference between the target reliability index, and the achieved reliability for any particular bridge can be evaluated.

The AASHTO LRFD Specifications are intended to address the design of a broad range of bridge components. Some, such as a simply supported girder in a two-girder cross-section, are statically determinate in both the longitudinal and transverse directions, and thus the load effects can be easily determined through simple statics. Others, such as a continuous girder in a multi-girder cross-section, are statically indeterminate in both the longitudinal and transverse directions. In the first instance, any analysis method should produce a result that is essentially identical and result in the target reliability. For the second example, the use of approximations and simplifications can introduce differences between calculated and actual load effects. *The framers of the specifications were very careful to ensure that what differences do develop result in conservative estimates of design effects when using these approximate methods, such as the distribution factor method. As a result, the use of approximate methods will generally cause the achieved reliability index of a structure to be higher than the target value.*

Referring to Case 3 above, if an approximate analysis results in a resistance being 25 percent higher than required to achieve a target reliability index of 3.5, the achieved reliability index can range from about 4.0 to almost 5.0. There are many instances in the AASHTO LRFD Specifications, and the Standard Specifications before them, where an approximate method is given in lieu of a more refined one, with the understanding that the approximate method will produce more conservative results. This occurs both in terms of analysis of load effects as well as determination of resistances. *When a designer chooses to use an approximate method, the design force effects will tend to be conservative, resulting in larger design forces. It should come as no surprise that the design will have an increased resistance, and therefore a higher reliability, due to the higher ratio of resistance to actual demand.*

It is important at this point to consider the degree of conservatism that may or may not be present in the distribution factor method. The examples contained in this manual do show that a relatively significant amount of savings is available when more refined analysis methods are used, but previous studies have indicated smaller differences (Zokaie, 2000). LRFD distribution factors tend to be more conservative resulting in greater differences with refined analysis distribution when the lever rule is used or at the limits of applicability of the LRFD distribution factors (Yousif, 2007). In any event, *for structures that have less indeterminacy, the achieved*

> **Figure 7** · image · p. 17 : Figure 146. Illustration. Example 1 framing plan.
>
> *texte de l'image non extractible du PDF : voir l'image*

Figure 147 shows the Example 1 bridge cross-section. The composite concrete deck slab is 8½ inches thick including a ½ inch integral wearing surface; the deck slab utilizes 4 ksi concrete. The intermediate diaphragms are 10 inches wide by 3 ft-10 inches deep. The pier continuity diaphragms are 30 inches wide by approximately 7 ft-2¼ inches deep while the abutment diaphragms are 4 feet wide by approximately 6 ft-6 inches deep. The diaphragms utilize 3.5 ksi concrete.

> **Figure 8** · image · p. 17 : Figure 147. Illustration. Example 1 bridge cross-section.
>
> *texte de l'image non extractible du PDF : voir l'image*

228

### 9.1.1 1D Line Girder Analysis

The three simple spans shown in Figure 146 that are made continuous for composite dead loads and live loads are modeled with a 1D Line Girder Analysis. To adequately capture behavior in the different loading stages at least three separate models are required; one for non-composite dead loads, one for composite dead loads, and one for live load. Because simply supported and continuous support conditions are both considered for composite dead load and live load in these examples an additional two models are used. The 1D line girder analysis utilizes the approximate distribution factors contained in Article 4.6.2.2 of the AASHTO LRFD Bridge Design Specifications (AASHTO LRFD). The following steps are used to determine the dead and live load moments, shears, and deflections:

1. Determine non-composite and composite section properties for interior and exterior girders.
2. Calculate moment distribution factors for interior and exterior girders for one lane loaded and multiple lanes loaded.
3. Determine the dead loads due to girder self-weight, concrete deck slab, haunches, barriers, intermediate diaphragms, stay-in-place (SIP) forms, and future wearing surface (FWS).
4. Develop and run analysis models. (Notes: Depending on software, several models may have to be developed using the different section properties from Step 1; live load distribution factors from Step 2 may, depending on software, be included in the developed model and distributed moments will be provided as results)
5. Develop moment, shear, and deflection diagrams for non-composite dead load, composite dead load, and live load.

In this analysis, the following models are developed and used to determine the dead and live load moments, shears, and deflections:

- Non-composite section properties with non-composite dead loads applied; o These dead loads include the following: girder self-weight, SIP forms (if used), diaphragms, haunches, and concrete deck slab.

o The non-composite dead loads are applied to a simply supported girder. Before the concrete deck hardens the girders span between bearings and act independently to resist loads.

- Composite section properties with composite dead loads applied; o Composite dead loads include the barriers and future wearing surface. Because these loads act in long-duration, variation in time-dependent material properties caused by factors such as creep must be accounted for. Depending on the level of complexity required, a thorough treatment of creep behavior and its resulting effects may be modeled; however, this is not done in these examples. o The composite dead loads are applied to both simply supported and continuous girders. As the concrete deck (including concrete placed between the ends of girders in adjacent spans) hardens and attains stiffness (and the ability to transmit load), the system becomes continuous. However, in the interest of conservatism, 229

some agencies require an assumed loss in continuity which reverts back to the previously stated simply supported condition. Though it is not the typical case, this is the methodology used in the examples herein. As a result the maximum force effects from either the simply supported or continuous girder are utilized.

- Composite section properties with live load applied. o Similarly to the composite dead load model, live loads are applied to both simply supported and continuous girders, utilizing the force effects of the worst condition.

o Live loads considered in these examples include HL-93 Trucks as prescribed by AASHTO LRFD Section 3.6.1.2.1, but investigation of other project specific loads may also be required. Because live loads are considered short-duration loads, no consideration is given to time-dependent material properties.

#### 9.1.1.1 Step 1 – Determine Non-Composite and Composite Section Properties

#### 9.1.1.1.1 Non-Composite Section Properties – Interior and Exterior Girders

The non-composite section properties are calculated using basic mechanics of materials equations. These include equations for the moment of inertia about the centroidal axes of rectangles and triangles as well as the parallel axis theorem. These equations are shown as Equation (32) through Equation (34).

> **Figure 9** · image · p. 19
>
> *texte de l'image non extractible du PDF : voir l'image*

**(32)**

**(33) (34)**

The non-composite section properties for the AASHTO Type VI precast concrete beam are calculated below in Table with the different areas shown in Figure 148 and the dimensions shown in Figure 149. The second row of the table indicates the column number.

**Table 9. Non-composite section property calculation.**

<table>
<tr><th>Comp.</th><th>#</th><th>b<br>(in)</th><th>h<br>(in)</th><th>A<br>(in²)</th><th>y<br>(in)</th><th>Ay<br>(in³)</th><th>d=(y-ybar)<br>(in)</th><th>Ad²(in4)</th><th>Io (in4)</th><th>I = Io +Ad²<br>(in4)</th></tr>
<tr><td>(1)</td><td>(2)</td><td>(3)</td><td>(4)</td><td>(5)</td><td>(6)</td><td>(7)</td><td>(8)</td><td>(9)</td><td>(10)</td><td>(11)</td></tr>
<tr><td>A1</td><td>1</td><td>42</td><td>5</td><td>210</td><td>69.5</td><td>14595.0</td><td>33.12</td><td>230347.25</td><td>437.5</td><td>230785</td></tr>
<tr><td>A2</td><td>2</td><td>13</td><td>3</td><td>39</td><td>66</td><td>2574.0</td><td>29.62</td><td>34214.94</td><td>19.5</td><td>34234</td></tr>
<tr><td>A3</td><td>2</td><td>4</td><td>3</td><td>24</td><td>65.5</td><td>1572.0</td><td>29.12</td><td>20350.48</td><td>18.0</td><td>20368</td></tr>
<tr><td>A4</td><td>2</td><td>4</td><td>4</td><td>16</td><td>62.7</td><td>1002.7</td><td>26.29</td><td>11055.28</td><td>14.22</td><td>11069</td></tr>
<tr><td>A5</td><td>1</td><td>8</td><td>59</td><td>472</td><td>37.5</td><td>17700.0</td><td>1.12</td><td>591.39</td><td>136919</td><td>137510</td></tr>
<tr><td>A6</td><td>2</td><td>10</td><td>10</td><td>100</td><td>11.3</td><td>1133.3</td><td>-25.05</td><td>62736.78</td><td>555.56</td><td>63292</td></tr>
<tr><td>A7</td><td>1</td><td>28</td><td>8</td><td>224</td><td>4</td><td>896.0</td><td>-32.38</td><td>234865.38</td><td>1194.67</td><td>236060</td></tr>
<tr><td colspan="4">ΣA=</td><td>1085</td><td>ΣAy=</td><td>39473.0</td><td colspan="3">Ix =</td><td>733320</td></tr>
</table>

ybar = ΣA y/ΣA= 36.38 inches A = 1085 in² Ix = 733320.29 in4

230

> **Figure 10** · image · p. 20 : Figure 148. Illustration. Components of Figure 149. Illustration. Dimensions of AASHTO Type VI prestressed beam. AASHTO Type VI prestressed beam.
>
> *texte de l'image non extractible du PDF : voir l'image*

> **Figure 11** · image · p. 20
>
> *texte de l'image non extractible du PDF : voir l'image*

#### 9.1.1.1.2 Composite Section Properties for Interior Girders

The composite section properties for the interior girders are calculated below. Because the deck slab and beam have different stiffness properties, the modular ratio must be calculated to create a transformed section and enforce the assumption that plane sections remain plane. The modular ratio is the ratio of modulus of elasticity for the beam to the modulus of elasticity of the deck slab. The modulus of elasticity of concrete with compressive strengths less than or equal to 5.0 ksi is calculated using the concrete compressive strength and AASHTO LRFD Equation C5.4.2.4-1, shown here as Equation (35). For concrete with compressive strength greater than 5 ksi, Equation (36) is used where wc is given by Equation (37) and K1 is taken equal to 1.0. The modulus of elasticity for the beam is determined to be 5314 ksi and for the deck slab is determined to be 3640 ksi, based on compressive strengths of 8 and 4 ksi respectively. The modular ratio, given by Equation (38), is 1.46.

> **Figure 12** · image · p. 20
>
> *texte de l'image non extractible du PDF : voir l'image*

**(35)**

**(36)**

231

> **Figure 13** · image · p. 21
>
> *texte de l'image non extractible du PDF : voir l'image*

**(37)**

**(38)**

The deck slab contribution depends on the effective flange width determined according to AASHTO LRFD Article 4.6.2.6. This section indicates that the center-to-center girder spacing should be used as the effective flange width for the interior girders. The depth of the haunch and the ½ inch integral wearing surface are conservatively not included in any of the section properties calculated in this example.

**Table 10. Composite section property calculation – interior girder.**

<table>
<tr><th>Comp.</th><th>b<br>(in)</th><th>h<br>(in)</th><th>A<br>(in²)</th><th>y<br>(in)</th><th>Ay<br>(in³)</th><th>d=(y-ybar)<br>(in)</th><th>Ad²(in4)</th><th>Io (in4)</th><th>I = Io<br>+Ad²(in4)</th></tr>
<tr><td>(1)</td><td>(3)</td><td>(4)</td><td>(5)</td><td>(6)</td><td>(7)</td><td>(8)</td><td>(9)</td><td>(10)</td><td>(11)</td></tr>
<tr><td>Deck</td><td>94.52</td><td>8</td><td>756.2</td><td>76</td><td>57468.9</td><td>23.35</td><td>412198.0</td><td>4032.90</td><td>416230.9</td></tr>
<tr><td>Beam</td><td>-</td><td>-</td><td>1085</td><td>36.38</td><td>39473</td><td>-16.27</td><td>287273.2</td><td>733320.3</td><td>1020593.5</td></tr>
<tr><td colspan="3">ΣA=</td><td>1841.2</td><td>ΣAy=</td><td>96941.9</td><td colspan="3">Ix =</td><td>1436824.3</td></tr>
</table>

ybar = ΣA y/ΣA= 52.65 inches A = 1841.2 in² Ix = 1436824.3 in4

#### 9.1.1.1.3 Composite Section Properties for Exterior Girders

The calculation is identical to that of the interior girders except that the effective flange width is different for exterior girders. AASHTO LRFD Article 4.6.2.6 indicates that one-half the centerto-center girder spacing plus the overhang width should be used as the effective flange width for exterior girders.

**Table 11. Composite section property calculation – exterior girder.**

<table>
<tr><th>Comp.</th><th>b<br>(in)</th><th>h<br>(in)</th><th>A<br>(in²)</th><th>y<br>(in)</th><th>Ay<br>(in³)</th><th>d=(y-ybar)<br>(in)</th><th>Ad²(in4)</th><th>Io (in4)</th><th>I = Io<br>+Ad²(in4)</th></tr>
<tr><td>(1)</td><td>(3)</td><td>(4)</td><td>(5)</td><td>(6)</td><td>(7)</td><td>(8)</td><td>(9)</td><td>(10)</td><td>(11)</td></tr>
<tr><td>Deck</td><td>83.73</td><td>8</td><td>669.9</td><td>76</td><td>50909.9</td><td>24.50</td><td>401952.3</td><td>3572.6</td><td>405524.9</td></tr>
<tr><td>Beam</td><td>-</td><td>-</td><td>1085</td><td>36.38</td><td>39473</td><td>-15.12</td><td>248161.0</td><td>733320.3</td><td>981481.3</td></tr>
<tr><td colspan="3">ΣA=</td><td>1754.9</td><td>ΣAy=</td><td>90382.9</td><td colspan="3">Ix =</td><td>1387006.2</td></tr>
</table>

ybar = ΣA y/ΣA= 51.50 inches A = 1754.9 in² Ix = 1387006.2 in4

#### 9.1.1.2 Step 2 – Determine Approximate Live Load Distribution Factors

#### 9.1.1.2.1 Interior Girder Moment Distribution Factors

Equations for the approximate live load distribution factors, “g,” are provided in AASHTO LRFD Article 4.6.2.2. Different cross-section types are provided in AASHTO LRFD Table 4.6.2.2.1-1; comparing Figure 147 to those in the table, it is determined that cross-section “k” is similar. Using the cross-section type and AASHTO LRFD Table 4.6.2.2.2b-1, the equations for the moment distribution factors for interior girders can be found.

232

The distribution factor equations for live load moment in interior girders are shown as Equation (39) for one lane loaded and Equation (40) for multiple lanes loaded.

> **Figure 14** · image · p. 22
>
> *texte de l'image non extractible du PDF : voir l'image*

**(39)**

**(40)**

Where: S = girder spacing [ft]

L = span length [ft] ts = deck slab thickness [in] Kg = longitudinal stiffness parameter [in4] = n(Ix + Aeg²) n = modular ratio A, Ix = area and moment of inertia for non-composite beam eg = distance between centers of gravity of the non-composite beam and deck

slab [in]

g = distribution factor

The first step in determining the approximate distribution factors is to determine the value of Kg. This value is the same for both the interior and exterior girders as the same beam is used. The non-composite area and moment of inertia are found in Table 9. The value for “eg” is determined using Equation (41) and found to be 39.62 inches.

> **Figure 15** · image · p. 22
>
> *texte de l'image non extractible du PDF : voir l'image*

**(41)**

Substituting all values into the equation for Kg, determine that Kg is 3557176 in4.

The second step in determining the approximate distribution factors is to determine if the bridge characteristics satisfy the range of applicability listed in AASHTO LRFD Table 4.6.2.2.2b-1. These characteristics, the range of applicability, and the Example 1 bridge values are shown in Table 12.

**Table 12. Bridge characteristics for distribution factor equations.**

| Characteristic | Range | Satisfied for Example 1 |
| --- | --- | --- |
| Girder spacing, S | 3.5 ≤ S ≤ 16.0 | S = 11.5, YES |
| Deck Slab thickness, ts | 4.5 ≤ ts ≤ 12.0 | ts = 8, YES |
| Span length, L | 20 ≤ L ≤ 240 | L = 114.25 and 115.25, YES |
| Number of beams, Nb | Nb ≥ 4 | Nb = 4, YES |
| Longitudinal Stiffness, Kg | 10,000 ≤ Kg ≤ 7,000,000 | Kg = 3557176, YES |

Since all of the criteria are satisfied, the approximate distribution factors of Equations (39) and (40) can be used to calculate the moment distribution factors for the interior girders. The distribution factors depend on the span length; the center span of this bridge is slightly longer

233

than the side spans, therefore separate distribution factors will be calculated for the center span. Additionally for negative moment between dead load points of contraflexure (POCs), AASHTO LRFD indicates that the average of the two span lengths can be used (See AASHTO LRFD Table C4.6.2.2.1-1). Calculation of the moment distribution factor in an interior girder for one lane loaded is shown below, the others are similarly calculated and are shown in Table 13 below.

> **Figure 16** · image · p. 23
>
> *texte de l'image non extractible du PDF : voir l'image*

**Table 13. Interior girder moment distribution factors.**

<table>
<tr><th>Action</th><th>Lanes<br>Loaded</th><th>Spans 1<br>and 3</th><th>Span 2</th></tr>
<tr><td rowspan="2">M+ and M- not between POCs</td><td>1</td><td>0.61</td><td>0.60</td></tr>
<tr><td>2+</td><td>0.91</td><td>0.91</td></tr>
<tr><td rowspan="2">M- between POCs</td><td>1</td><td colspan="2">0.61</td></tr>
<tr><td>2+</td><td colspan="2">0.91</td></tr>
</table>

#### 9.1.1.2.2 Exterior Girder Moment Distribution Factors

AASHTO LRFD Table 4.6.2.2.2d-1 indicates that for one lane loaded, the lever rule should be used; for two or more lanes loaded, use the equation provided in AASHTO LRFD Table 4.6.2.2.2d-1. But in no case, for any number of lanes loaded, should the distribution factor be less than that calculated using AASHTO LRFD Eq. C4.6.2.2.2d-1 which assumes a rigid cross-section.

The lever rule uses statics to distribute the live load to the girders. The lever rule assumes that the deck slab is hinged at the interior girder and is therefore statically determinant transversely. Figure 150 shows the dimensions necessary to calculate the moment distribution factor via the lever rule. Using the lever rule also requires application of the multiple presence factor in AASHTO LRFD Table 3.6.1.1.2-1.

234

> **Figure 17** · image · p. 24 : Figure 150. Illustration. Lever rule dimensions.
>
> *texte de l'image non extractible du PDF : voir l'image*

The dimensions shown in Figure 150 are defined as: S is the girder spacing, OVER is the overhang width, P1 and P2 are the left and right wheel centerlines respectively, X1 is the distance from the left wheel to centerline of exterior girder, and X2 is the distance from the exterior girder centerline to the right wheel. X1 is determined using Equation (42), where “barrier” is the width of the barrier, and X2 is determined using Equation (43). X1 is negative if the wheel line is between the edge of the deck slab and the centerline of the exterior girder and positive if between girders. The distribution factor can then be calculated using Equation (44), where m is the multiple presence factor from AASHTO LRFD Table 3.6.1.1.2-1.

> **Figure 18** · image · p. 24
>
> *texte de l'image non extractible du PDF : voir l'image*

**(42) (43)**

**(44)**

Using the dimensions in Figure 147 and Equations (42) and (43), X1 is determined to be -9 inches and X2 is determined to be 63 inches. Using Equation (44) and selecting the multiple presence factor from AASHTO LRFD Table 3.6.1.1.2-1 for one lane loaded, the distribution factor is calculated as 0.97 lanes.

> **Figure 19** · image · p. 24
>
> *texte de l'image non extractible du PDF : voir l'image*

For multiple lanes loaded, AASHTO LRFD Table 4.6.2.2.2d-1 indicates to use the equation provided in the table. The moment distribution factor for multiple lanes loaded and exterior girders is given by Equation (45) and “e” is given by Equation (46).

> **Figure 20** · image · p. 24
>
> *texte de l'image non extractible du PDF : voir l'image*

**(45)**

**(46)**

In Equation (46), de is the horizontal distance from the centerline of the web of the exterior girder to the interior face of the traffic barrier. Using Equation (47), de is determined. AASHTO LRFD Table 4.6.2.2.2d-1 indicates that the calculated value of de must be between -1.0 ft and 5.5

235

ft. Figure 147 indicates the overhang width to be 4 ft-5¼ inches and the barrier width to be 1 ft- 8¼ inches, giving a value of de equal to 2.75 ft; this value is between -1.0 ft and 5.5 ft.

**(47)**

Substituting de into Equation (46), “e” is determined to be 1.072. Table 14 shows the moment distribution factors determined using AASHTO LRFD Table 4.6.2.2.2d-1 for multiple lanes loaded.

**Table 14. Exterior girder moment distribution factors.**

<table>
<tr><th>Action</th><th>Lanes Loaded</th><th>Spans 1 and 3</th><th>Span 2</th></tr>
<tr><td>M+ and M- not between POCs</td><td>2+</td><td>0.97</td><td>0.97</td></tr>
<tr><td>M- between POCs</td><td>2+</td><td colspan="2">0.97</td></tr>
</table>

The final step to determine the moment distribution factor for the exterior girders is to consider the rigid cross-section analysis of AASHTO LRFD C4.6.2.2.2d. The live load distributed to the exterior girder is determined using Equation (48).

> **Figure 21** · image · p. 25
>
> *texte de l'image non extractible du PDF : voir l'image*

**(48)**

Where: R = reaction on exterior beam in terms of lanes

m = multiple presence factor, from AASHTO LRFD Table 3.6.1.1.2-1 NL = number of loaded lanes under consideration e = eccentricity of design truck or design lane load from center of gravity of the pattern of girders [ft] x = horizontal distance from center of gravity of girder pattern to each girder [ft] Xext = horizontal distance from center of gravity of girder pattern to exterior girder [ft] Nb = number of beams/girders

One Lane Loaded: Two Lanes Loaded: Multiple Presence Factor: (Table 3.6.1.1.2-1) Multiple Presence Factor: (Table 3.6.1.1.2-1) m = 1.2 m = 1.0 First Term of Equation (48): First Term of Equation (48): NL = 1 NL = 2 Nb = 4 Nb = 4

NL/Nb = 0.25 NL/Nb = 0.5 Second Term of Equation (48): Second Term of Equation (48): Xext = 1.5×11.5 ft = 17.25 ft Xext = 1.5×11.5 = 17.25 ft

′ ′

e1 = 𝑋𝑋𝑒𝑒𝑒𝑒𝑓𝑓 + 𝑂𝑂𝑂𝑂𝑂𝑂𝑂𝑂 − 𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝑒𝑒𝐵𝐵12 − 2′−62 = 15 ft e1 = 𝑋𝑋𝑒𝑒𝑒𝑒𝑓𝑓 + 𝑂𝑂𝑂𝑂𝑂𝑂𝑂𝑂 − 𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝐵𝑒𝑒𝐵𝐵12 − 2′−62 = 15 ft

e2 = 𝑒𝑒1 − 12 𝑓𝑓𝑓𝑓 = 3 ft

Σe = 15 ft Σe = 15ft + 3 ft = 18 ft

x1, x4 = 1.5×11.5 ft = 17.25 ft x1, x4 = 1.5×11.5 ft = 17.25 ft x2, x3 = 0.5×11.5 ft = 5.75 ft x2, x3 = 0.5×11.5 ft = 5.75 ft Σx² = 2×(5.75 ft)²+ 2 ×(17.25 ft)²= 661.25 ft² Σx²= 2×(5.75 ft)²+ 2 ×(17.25 ft)²= 661.25 ft²

236

> **Figure 22** · image · p. 26
>
> *texte de l'image non extractible du PDF : voir l'image*

> **Figure 23** · image · p. 26
>
> *texte de l'image non extractible du PDF : voir l'image*

Reaction on Exterior Beam: Reaction on Exterior Beam:

> **Figure 24** · image · p. 26
>
> *texte de l'image non extractible du PDF : voir l'image*

> **Figure 25** · image · p. 26
>
> *texte de l'image non extractible du PDF : voir l'image*

= 1.2×(0.25+0.39) = 1.0×(0.50+0.47) = 0.77 lanes = 0.97 lanes

The moment distribution factors for the exterior girders are summarized in Table 15. For one lane loaded, AASHTO LRFD Table 4.6.2.2.2d-1 resulted in a larger distribution factor than assuming a rigid cross-section; for multiple lanes loaded the opposite occurred. For the exterior girders, the moment distribution factor is 0.97.

**Table 15. Exterior girder distribution factor summary.**

|  | One Lane Loaded | Multiple Lanes Loaded |
| --- | --- | --- |
| Table 4.6.2.2.2d-1 | 0.97 | 0.97 |
| Rigid Cross-Section | 0.77 | 0.97 |

#### 9.1.1.3 Step 3 – Determine Dead Loads

#### 9.1.1.3.1 Self-Weight of Girder, wsw

The unit weight of concrete girders is assumed to be 150 pounds per cubic foot. The cross-section area is 7.54 ft². The self-weight of the girder, wsw, is equal to wsw = 7.54 ft²× 150 lb/ft³ = 1,131 lb/ft = 1.13 kip/ft.

#### 9.1.1.3.2 Weight of Stay-in-Place Forms, wsip

Stay-in-place forms with an assumed weight of 0.015 ksf are used. The weight includes the weight of the form as well as the concrete in the form valleys. For the interior girders, the weight for SIP forms is 0.015 ksf × 11.5 ft = 0.17 k/ft. For the exterior girders, the SIP forms are used only between girders; therefore the weight of SIP forms is 0.015 ksf × 5.75 ft = 0.086 k/ft.

#### 9.1.1.3.3 Weight of Concrete Deck Slab, wdeck

For the interior girder, the tributary width is taken as one-half the girder spacing on each side of the girder while for the exterior girder, the tributary width is taken as the overhang plus one-half the girder spacing. The deck slab is 8½ inches thick, including a ½ inch integral wearing surface. The concrete deck slab unit weight is assumed to be 150 pounds per cubic foot. The weight of the concrete deck slab for the interior and exterior girders is determined below.

Interior Girder: Exterior Girder: Tributary Width, tw: Tributary Width, tw: tw = S/2 + S/2 = S tw = S/2 + Overhang = 11.5 ft = 11.5 ft/2 + 4 ft-5¼ inches = 10.1875 ft

Deck Slab Thickness, ts: Deck Slab Thickness, ts:

237

# 9.2.1 1D Line Girder Analysis

1D line girder analysis utilizes the approximate distribution factors contained in Article 4.6.2.2 of the AASHTO LRFD Bridge Design Specifications (Specifications). The following steps are used to determine the dead and live load bending moments, shears, and deflections:

1. Determine non-composite and short- and long-term composite section properties for interior and exterior girders.
2. Calculate moment distribution factors for interior and exterior girders for one lane loaded and multi-lane loaded situations.
3. Determine and input magnitude (generally in kips or kips per foot) of dead loads due to girder self-weight, concrete deck slab, haunches, barrier, and cross-frames.
4. Develop and run analysis models. (Notes: Depending on software, several models may have to be developed using the different section properties from Step 1; live load distribution factors from Step 2 may, depending on software, be included in the developed model and distributed moments (and shears) will be provided as results)
5. Develop moment, shear, and deflection diagrams for non-composite dead load, composite dead load, and live load.

In this analysis, the following models are developed and used to determine the dead and live load bending moments, shears, and deflections:

- Non-composite section properties with non-composite dead loads applied; o The non-composite dead loads are applied to a continuous girder. o These dead loads include the following: girder self-weight, cross-frames, haunches, and concrete deck slab.
- Long-term composite section properties with composite dead loads applied; and o The composite dead loads are applied to a continuous girder. o Composite dead loads include the barrier and future wearing surface.
- Short-term composite section properties with live load applied. o The live load is applied to a continuous girder.

*9.2.1.1 Step 1 – Determine Non-Composite and Various Composite Section Properties*

9.2.1.1.1 Non-Composite Section Properties – Interior and Exterior Girders

The non-composite section properties are calculated using basic mechanics of materials equations and are shown in Table 28. For details, see Example 1.

**Table 28. Example 2 non-composite section properties.**

| Section | Area (in²) | Moment of Inertia (in4) |
| --- | --- | --- |
| Section A-A | 93.50 | 118401 |
| Section B-B | 112.75 | 160309 |
| Section C-C | 168.00 | 286524 |

313

9.2.1.1.2 Long-Term Composite Section Properties for Interior Girders

The long-term composite section properties for the interior girders are calculated below. Due to the different materials used in the deck slab and beam, the modular ratio must be calculated. The modular ratio is the ratio of modulus of elasticity for the beam to the modulus of elasticity of the deck slab. The modulus of elasticity of concrete is calculated using the concrete compressive strength and AASHTO LRFD Equation C5.4.2.4-1, shown here as Equation (49). The modulus of elasticity for the beam is 29,000 ksi and for the deck slab is determined to be 3640 ksi, for a compressive strength of 4 ksi. The modular ratio, given by Equation (50), is then 29000 ksi divided by 3640 ksi which is equal to 7.96 (rounded to 8).

> **Figure 26** · image · p. 28
>
> *Texte dans la figure :* (49) · (50)

The long-term section properties are shown in Table 29 using an effective modular ratio of 3n to account for the effects of creep. The effective modular ratio is used to convert the deck slab concrete into an equivalent area of steel. The deck slab contribution depends on the effective flange width determined according to AASHTO LRFD Article 4.6.2.6 which indicates that the center-to-center girder spacing should be used as the effective flange width for the interior girders. The depth of the haunch and the ½ inch integral wearing surface are, conservatively, not included in the section property calculation.

**Table 29. Example 2 interior girder long-term composite section properties.**

| Section | Area (in²) | Moment of Inertia (in4) |
| --- | --- | --- |
| Section A-A | 143.00 | 204576 |
| Section B-B | 162.25 | 260717 |
| Section C-C | 217.50 | 406754 |

9.2.1.1.3 Short-Term Composite Section Properties for Interior Girders

The short-term section properties are calculated using the modular ratio as indicated previously and shown in Table 30. The center-to-center girder spacing is used for the effective flange width. Because there are no creep effects for loads of short duration no modification of the modular ratio is applied. To account for the different material properties, the effective flange width is divided by the modular ratio. As above, the depth of the haunch and the ½ inch integral wearing surface are, conservatively, not included in the section property calculation.

**Table 30. Example 2 interior girder short-term composite section properties.**

| Section | Area (in²) | Moment of Inertia (in4) |
| --- | --- | --- |
| Section A-A | 242.00 | 271576 |
| Section B-B | 261.25 | 347766 |
| Section C-C | 316.50 | 534705 |

314

9.2.1.1.4 Long-Term and Short-Term Composite Section Properties for Exterior Girders

The long-term and short-term composite section properties for the exterior girders are shown in Tables 31 and 32, respectively. The calculation is identical to that of the interior girders except that the effective flange width is different for exterior girders. AASHTO LRFD Article 4.6.2.6 indicates that one-half the center-to-center girder spacing plus the overhang width should be used as the effective flange width for exterior girders. As above, the depth of the haunch and the ½ inch integral wearing surface are, conservatively, not included in the section property calculation.

**Table 31. Example 2 exterior girder long-term composite section properties.**

| Section | Area (in²) | Moment of Inertia (in4) |
| --- | --- | --- |
| Section A-A | 135.13 | 195073 |
| Section B-B | 154.38 | 249036 |
| Section C-C | 209.63 | 391414 |

**Table 32. Example 2 exterior girder short-term composite section properties.**

| Section | Area (in²) | Moment of Inertia (in4) |
| --- | --- | --- |
| Section A-A | 218.38 | 261051 |
| Section B-B | 237.63 | 333531 |
| Section C-C | 292.88 | 511988 |

*9.2.1.2 Step 2 – Determine Approximate Live Load Distribution Factors*

9.2.1.2.1 Interior Girder Distribution Factors

The approximate live load distribution factor equations are provided in AASHTO LRFD Article 4.6.2.2. Different cross-section types are provided in AASHTO LRFD Table 4.6.2.2.1-1; comparing Figure 194 to those in the table, it is determined that cross-section “a” is similar. The controlling distribution factors for the interior and exterior girders are summarized in Table 33. For detailed calculation of the distribution factors, refer to Appendix 9.A.

**Table 33. Example 2 distribution factors.**

<table>
<tr><th rowspan="2">Girder</th><th rowspan="2">Action</th><th colspan="4">Spans 1<br>and 3</th><th colspan="3">Span 2</th></tr>
<tr><td>A-A</td><td>B-B</td><td colspan="2">C-C</td><td>A-A</td><td>B-B</td><td>C-C</td></tr>
<tr><td>Interior Girder</td><td rowspan="2">M+ and M- not<br>between POCs</td><td>0.76</td><td>0.78</td><td colspan="2">0.82</td><td>0.71</td><td>0.73</td><td>0.76</td></tr>
<tr><td>Exterior Girder</td><td>0.92</td><td>0.92</td><td colspan="2">0.92</td><td>0.92</td><td>0.92</td><td>0.92</td></tr>
<tr><td></td><td></td><td colspan="3">A-A</td><td colspan="2">B-B</td><td colspan="2">C-C</td></tr>
<tr><td>Interior Girder</td><td rowspan="2">M- between POCs</td><td colspan="3">0.73</td><td colspan="2">0.75</td><td colspan="2">0.79</td></tr>
<tr><td>Exterior Girder</td><td colspan="3">0.92</td><td colspan="2">0.92</td><td colspan="2">0.92</td></tr>
<tr><td></td><td></td><td colspan="3">A-A</td><td colspan="2">B-B</td><td colspan="2">C-C</td></tr>
<tr><td>Interior Girder</td><td rowspan="2">Shear</td><td colspan="3">1.02</td><td colspan="2">1.02</td><td colspan="2">1.02</td></tr>
<tr><td>Exterior Girder</td><td colspan="3">0.90</td><td colspan="2">0.90</td><td colspan="2">0.90</td></tr>
</table>

315

*9.2.1.3 Step 3 – Determine Dead Loads on a “Per Girder” Basis* 9.2.1.3.1 Self-Weight of Girder, wsw The self-weight of the girder is calculated using the cross-section area and unit weight of the material. The values are summarized in Table 34.

**Table 34. Example 2 girder self-weight.**

| Cross-Section | Lineal Weight (k/ft) |
| --- | --- |
| A-A | 0.319 |
| B-B | 0.384 |
| C-C | 0.575 |

9.2.1.3.2 Weight of Stay-in-Place Forms, wsip

Stay-in-place forms with an assumed weight of 0.015 ksf are used. The weight includes the weight of the form as well as the concrete in form valleys. For the interior girders, the weight for SIP forms is 0.015 ksf × 11 ft = 0.17 k/ft. For the exterior girders, the weight of SIP forms is 0.015 ksf × 5.5 ft = 0.083 k/ft.

9.2.1.3.3 Weight of Concrete Deck Slab, wdeck

The weight of the concrete deck slab is determined on a basis of tributary width for the interior and exterior girders. For the interior girder, the tributary width is taken as one-half the girder spacing on each side of the girder while for the exterior girder, the tributary width is taken as the overhang plus one-half the girder spacing. The resulting loads are 1.31 k/ft for interior girders and 1.10 k/ft for exterior girders.

9.2.1.3.4 Weight of Concrete Haunches

The weight of the haunch is determined using the cross-section area of the haunch and the unit weight of concrete. For the interior girders, the total depth (deck slab plus haunch) is 1 ft-2½ inches at the centerline of the girder with the deck slab having a 2 percent cross-slope.

> **Figure 27** · image · p. 30 : Figure 196. Illustration. Haunch area for interior girders.
>
> *texte de l'image non extractible du PDF : voir l'image*

316

*9.3.4.3 Conclusions*

Of the effects studied, major-axis moment, shear and deflection showed the best agreement, while there was significant variability in the lateral moments. The level of accuracy observed for all but lateral moments were in a range of reasonable acceptability (within 10 percent in most cases). From Tables 60 and 61, major-axis bending moment results between the two- and three-dimensional cases are within 12 percent.

**Table 60. 2D/3D ratios for maximum positive major-axis bending moment.**

<table>
<tr><th colspan="3">G1</th><th colspan="3">G2</th><th colspan="3">G3</th><th colspan="3">G4</th></tr>
<tr><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td></tr>
<tr><td>1.00</td><td>0.95</td><td>0.98</td><td>1.00</td><td>1.02</td><td>1.00</td><td>1.00</td><td>1.01</td><td>1.01</td><td>0.99</td><td>1.00</td><td>1.01</td></tr>
<tr><td>1.12</td><td>0.95</td><td>1.03</td><td>1.00</td><td>0.96</td><td>0.99</td><td>0.98</td><td>0.99</td><td>0.97</td><td>0.97</td><td>1.00</td><td>0.99</td></tr>
<tr><td>0.99</td><td>1.03</td><td>1.01</td><td>1.04</td><td>1.05</td><td>1.01</td><td>1.00</td><td>1.02</td><td>1.03</td><td>0.99</td><td>1.00</td><td>1.05</td></tr>
</table>

**DC1 DC2+DW LL**

**Table 61. 2D/3D ratio for maximum negative major-axis bending moment.**

<table>
<tr><th colspan="3">G1</th><th colspan="3">G2</th><th colspan="3">G3</th><th colspan="3">G4</th></tr>
<tr><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td></tr>
<tr><td>1.11</td><td>1.06</td><td>1.06</td><td>1.03</td><td>1.02</td><td>1.02</td><td>1.10</td><td>1.10</td><td>1.05</td><td>1.06</td><td>1.06</td><td>1.06</td></tr>
<tr><td>1.04</td><td>0.96</td><td>0.96</td><td>0.99</td><td>0.93</td><td>0.93</td><td>1.05</td><td>1.05</td><td>1.05</td><td>1.07</td><td>1.07</td><td>1.10</td></tr>
<tr><td>0.96</td><td>1.03</td><td>1.03</td><td>0.96</td><td>0.97</td><td>0.97</td><td>0.95</td><td>0.98</td><td>0.98</td><td>0.90</td><td>0.90</td><td>1.08</td></tr>
</table>

**DC1 DC2+DW LL**

Table 62 shows the ratio of the 2D model to the 3D model for shear in each span. The results for shear are similar to those for major-axis bending moment, with most results from the two models being within 10 percent, but with a few cases in the 20-25 percent range. If the 2D model were used for design, the design live loads would, in most cases, be conservative. The exceptions would be Span 3 for Girder G1, Span 2 for Girder G3, and Span 1 for Girder G4.

**Table 62. 2D/3D ratios for shear.**

<table>
<tr><th colspan="3">G1</th><th colspan="3">G2</th><th colspan="3">G3</th><th colspan="3">G4</th></tr>
<tr><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td></tr>
<tr><td>1.00</td><td>1.02</td><td>1.02</td><td>0.97</td><td>0.97</td><td>0.97</td><td>1.05</td><td>1.05</td><td>1.05</td><td>1.01</td><td>1.01</td><td>1.02</td></tr>
<tr><td>0.98</td><td>0.84</td><td>0.84</td><td>0.97</td><td>0.97</td><td>0.96</td><td>0.98</td><td>1.02</td><td>1.09</td><td>0.97</td><td>0.93</td><td>1.00</td></tr>
<tr><td>1.19</td><td>1.11</td><td>0.95</td><td>1.21</td><td>1.01</td><td>1.00</td><td>1.23</td><td>0.98</td><td>1.14</td><td>0.80</td><td>1.10</td><td>1.10</td></tr>
</table>

# DC1 DC2+DW LL

From Table 63 it can be seen that the vertical system of the two-dimensional model is effectively slightly more flexible than the three-dimensional case. For non-composite dead load the results are mostly within 5 percent, however, as composite action develops the variation in deflection increases. Ideally the modifications made to the two-dimensional cross-frame elements would perfectly capture the stiffness of the three-dimensional system, but they are approximate methods and do a satisfactory job for a complex case.

**Table 63. 2D/3D ratios for deflection.**

<table>
<tr><th colspan="3">G1</th><th colspan="3">G2</th><th colspan="3">G3</th><th colspan="3">G4</th></tr>
<tr><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td></tr>
<tr><td>1.06</td><td>1.00</td><td>1.02</td><td>1.03</td><td>1.03</td><td>1.04</td><td>1.02</td><td>1.02</td><td>1.05</td><td>1.01</td><td>1.01</td><td>1.05</td></tr>
<tr><td>1.19</td><td>1.02</td><td>1.11</td><td>1.09</td><td>1.06</td><td>1.10</td><td>1.06</td><td>1.12</td><td>1.05</td><td>1.05</td><td>1.15</td><td>0.97</td></tr>
<tr><td>1.03</td><td>1.10</td><td>1.09</td><td>1.07</td><td>1.09</td><td>1.08</td><td>1.04</td><td>1.08</td><td>1.10</td><td>1.02</td><td>1.08</td><td>1.14</td></tr>
</table>

# DC1 DC2+DW LL

In general lateral behavior is not well predicted in two-dimensional models and agreement with actual behavior varies widely between bridges. The approximate equation which appears in AASHTO and is given by the V-Load method provides variable accuracy, which typically diminishes further when there are skewed supports, variable stiffness between girders, and away from cross-frame locations.

**Table 64. 2D/3D ratios for flange lateral bending moment.**

<table>
<tr><th colspan="3">G1</th><th colspan="3">G2</th><th colspan="3">G3</th><th colspan="3">G4</th></tr>
<tr><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td><td>Span<br>1</td><td>Span<br>2</td><td>Span<br>3</td></tr>
<tr><td>0.33</td><td>0.49</td><td>3.59</td><td>3.40</td><td>1.13</td><td>2.76</td><td>6.85</td><td>2.56</td><td>2.52</td><td>3.60</td><td>3.02</td><td>2.87</td></tr>
<tr><td>1.71</td><td>1.12</td><td>5.67</td><td>0.25</td><td>0.54</td><td>1.10</td><td>2.78</td><td>0.78</td><td>2.00</td><td>1.66</td><td>1.75</td><td>6.21</td></tr>
<tr><td>10.46</td><td>5.13</td><td>4.85</td><td>4.36</td><td>1.54</td><td>2.59</td><td>4.78</td><td>5.87</td><td>4.73</td><td>2.69</td><td>5.29</td><td>6.97</td></tr>
</table>

# DC1 DC2+DW LL

The cross-frame forces compare reasonably well between the 2D and 3D models as shown in the previous section.
