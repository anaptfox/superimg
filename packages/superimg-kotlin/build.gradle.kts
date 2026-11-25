import com.android.build.api.dsl.LibraryExtension
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
    kotlin("plugin.compose") version "2.1.20" apply false
    id("com.android.library") version "8.9.1" apply false
}

group = "dev.superimg"
version = property("superimg.kotlin.version") as String

val hasAndroidSdk: Boolean = run {
    val envHome = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
    val localProps = file("local.properties")
    (envHome != null && file(envHome).isDirectory) ||
        (localProps.exists() && localProps.readText().contains("sdk.dir"))
}

if (hasAndroidSdk) {
    apply(plugin = "com.android.library")
    apply(plugin = "org.jetbrains.kotlin.plugin.compose")
}

kotlin {
    jvmToolchain(17)

    jvm {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
        testRuns["test"].executionTask.configure {
            useJUnitPlatform()
        }
    }

    if (hasAndroidSdk) {
        androidTarget {
            compilerOptions {
                jvmTarget.set(JvmTarget.JVM_17)
            }
        }
    }

    applyDefaultHierarchyTemplate()

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.1")
            }
        }

        val jvmMain by getting

        if (hasAndroidSdk) {
            val androidMain by getting {
                dependencies {
                    implementation("androidx.compose.foundation:foundation:1.7.4")
                    implementation("androidx.compose.ui:ui:1.7.4")
                    implementation("androidx.compose.runtime:runtime:1.7.4")
                    implementation("androidx.core:core-ktx:1.13.1")
                }
            }
        }
    }
}

if (hasAndroidSdk) {
    extensions.configure<LibraryExtension> {
        namespace = "dev.superimg"
        compileSdk = 35

        defaultConfig {
            minSdk = 26
            consumerProguardFiles("consumer-rules.pro")
        }

        compileOptions {
            sourceCompatibility = JavaVersion.VERSION_17
            targetCompatibility = JavaVersion.VERSION_17
        }

        buildFeatures {
            compose = true
        }
    }
}
