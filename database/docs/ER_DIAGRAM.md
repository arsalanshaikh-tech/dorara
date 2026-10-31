# Dorara — Entity Relationship Diagram

The Travel module database, with the shared authentication core. All
relationships are modeled with MongoDB `ObjectId` references (no embedded
cross-collection documents), keeping collections small and future modules
(Education, Healthcare, Jobs, Business) easy to add.

## Relationship overview

```mermaid
erDiagram
    USER ||--|| USER_PROFILE : "has one"
    USER ||--o{ SESSION : "opens"
    SESSION ||--o{ REFRESH_TOKEN : "issues"
    USER ||--o{ REFRESH_TOKEN : "owns"
    USER ||--o{ EMAIL_VERIFICATION_TOKEN : "requests"
    USER ||--o{ PASSWORD_RESET_TOKEN : "requests"

    USER ||--o{ TRAVEL_REQUIREMENT : "submits"
    QUESTIONNAIRE ||--o{ TRAVEL_REQUIREMENT : "defines"
    TRAVEL_REQUIREMENT ||--|| DESTINATION_RECOMMENDATION : "produces"
    USER ||--o{ DESTINATION_RECOMMENDATION : "receives"
    DESTINATION ||--o{ DESTINATION_RECOMMENDATION : "appears in"

    USER ||--o{ SAVED_TRIP : "bookmarks"
    DESTINATION ||--o{ SAVED_TRIP : "saved as"
    DESTINATION_RECOMMENDATION ||--o{ SAVED_TRIP : "sourced from"

    USER ||--o{ SEARCH_HISTORY : "logs"
    DESTINATION ||--o{ USER_PROFILE : "favourited by"

    USER {
        ObjectId _id
        string firstName
        string lastName
        string username UK
        string email UK
        string password "bcrypt hash"
        string role
        string status
        bool isEmailVerified
        date lastLogin
        int loginCount
        int failedLoginAttempts
        date accountLockedUntil
    }

    USER_PROFILE {
        ObjectId _id
        ObjectId user FK "unique"
        string bio
        string nationality
        object travelPreferences
        object budgetPreference
        ObjectId[] favouriteDestinations FK
        object notificationPreferences
        object privacySettings
    }

    SESSION {
        ObjectId _id
        ObjectId user FK
        string sessionToken UK
        bool rememberMe
        date expiresAt "TTL"
        date revokedAt
    }

    REFRESH_TOKEN {
        ObjectId _id
        ObjectId user FK
        ObjectId session FK
        string tokenHash UK
        string family
        string replacedByTokenHash
        date expiresAt "TTL"
    }

    EMAIL_VERIFICATION_TOKEN {
        ObjectId _id
        ObjectId user FK
        string email
        string tokenHash UK
        date usedAt
        date expiresAt "TTL"
    }

    PASSWORD_RESET_TOKEN {
        ObjectId _id
        ObjectId user FK
        string tokenHash UK
        date usedAt
        date expiresAt "TTL"
    }

    QUESTIONNAIRE {
        ObjectId _id
        string vertical
        int version
        string title
        object[] steps
        bool isPublished
    }

    DESTINATION {
        ObjectId _id
        string slug UK
        string name
        string country
        string[] tags
        string[] weather
        number avgTempC
        number safetyIndex
        number costFactor
        object visa
    }

    TRAVEL_REQUIREMENT {
        ObjectId _id
        ObjectId user FK
        ObjectId questionnaire FK
        string vertical
        object answers
        object budget
        object dates
        string party
        string[] interestType
        number safetyImportance
        string status
    }

    DESTINATION_RECOMMENDATION {
        ObjectId _id
        ObjectId user FK
        ObjectId travelRequirement FK
        object[] recommendedDestinations
        object costEstimate
        object[] visaSummary
        object prosCons
        object[] alternatives
        object[] actionPlan
        string[] dataSources
        number confidenceScore
    }

    SAVED_TRIP {
        ObjectId _id
        ObjectId user FK
        ObjectId destination FK
        ObjectId recommendation FK
        object snapshot
        string note
    }

    SEARCH_HISTORY {
        ObjectId _id
        ObjectId user FK
        string vertical
        string query
        ObjectId travelRequirement FK
        ObjectId recommendation FK
        int resultCount
    }
```

## Core decision chain

The heart of the product maps directly onto the frontend flow
(welcome → consult → results):

```mermaid
flowchart LR
    U[User] --> TR[Travel Requirement<br/>questionnaire answers]
    Q[Questionnaire<br/>schema] -.defines.-> TR
    TR --> DR[Destination Recommendation]
    D[(Destination catalog)] -.ranked into.-> DR
    DR --> ST[Saved Trip]
    DR --> SH[Search History]
```
