package dev.roadmap;

import static com.tngtech.archunit.core.domain.JavaClass.Predicates.simpleNameEndingWith;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * T032 (FR-025): the layering of the constitution as a failing test. Controller (HTTP only) calls
 * service (rules), service calls repository (data); nothing points the other way and nothing skips
 * a layer.
 */
@AnalyzeClasses(packages = "dev.roadmap", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

  @ArchTest
  static final ArchRule layers =
      layeredArchitecture()
          .consideringOnlyDependenciesInLayers()
          .layer("Controller")
          .definedBy(simpleNameEndingWith("Controller"))
          .layer("Service")
          .definedBy(simpleNameEndingWith("Service"))
          .layer("Repository")
          .definedBy(simpleNameEndingWith("Repository"))
          .whereLayer("Controller")
          .mayNotBeAccessedByAnyLayer()
          .whereLayer("Service")
          .mayOnlyBeAccessedByLayers("Controller")
          .whereLayer("Repository")
          .mayOnlyBeAccessedByLayers("Service");

  /** The repository holds data access only; it must not know about HTTP. */
  @ArchTest
  static final ArchRule repositoryIsNotWeb =
      noClasses()
          .that(simpleNameEndingWith("Repository"))
          .should()
          .dependOnClassesThat()
          .resideInAPackage("org.springframework.web..");
}
