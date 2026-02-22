"use client"

import { useEffect, useMemo, useState } from "react"
import { normalizeProfessionCode, resolveProfessionLabel } from "@/shared/constants/profession"
import type { PeriodDetail, PeriodPayoutRow } from "@/features/payroll/api"
import type { ProfessionHierarchy } from "@/features/master-data/api"
import type { PayrollRow } from "../model/detail.types"
import { buildIssues, parseGroupNumber } from "../model/detail.helpers"
import type {
  PayrollIssueFilter,
  PayrollSortBy,
  ProfessionCardViewModel,
  ProfessionGroupsViewModel,
} from "../model/detail.view-model"

type UsePayrollDetailViewModelParams = {
  selectedProfession: string
  periodDetail: PeriodDetail | undefined
  payoutsData: PeriodPayoutRow[]
  rateHierarchyData: ProfessionHierarchy[] | undefined
  reviewedProfessionCodes?: string[]
  onAvailableProfessionsChange?: (professions: { code: string; label: string }[]) => void
  onSubmitForReview?: () => Promise<void>
}

export function usePayrollDetailViewModel({
  selectedProfession,
  periodDetail,
  payoutsData,
  rateHierarchyData,
  reviewedProfessionCodes = [],
  onAvailableProfessionsChange,
  onSubmitForReview,
}: UsePayrollDetailViewModelParams) {
  const [searchQuery, setSearchQuery] = useState("")
  const [rateFilter, setRateFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [issueFilter, setIssueFilter] = useState<PayrollIssueFilter>("all")
  const [sortBy, setSortBy] = useState<PayrollSortBy>("amount_desc")
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(true)

  const period = periodDetail?.period

  const { professionCards, professionGroups } = useMemo(() => {
    const hierarchy = (rateHierarchyData ?? []) as ProfessionHierarchy[]
    if (hierarchy.length) {
      const cards: ProfessionCardViewModel[] = hierarchy
        .map((profession) => {
          const internalCode = normalizeProfessionCode(profession.id)
          const rates = Array.from(
            new Set(
              profession.groups
                .map((group) => Number(group.rate))
                .filter((rate) => Number.isFinite(rate) && rate > 0),
            ),
          ).sort((a, b) => a - b)
          return {
            code: internalCode,
            label: resolveProfessionLabel(internalCode, profession.name),
            rates,
          }
        })
        .filter((card) => Boolean(card.code))

      const groups: ProfessionGroupsViewModel = {}
      hierarchy.forEach((profession) => {
        const internalCode = normalizeProfessionCode(profession.id)
        groups[internalCode] = profession.groups.map((group, index) => ({
          group: parseGroupNumber(group.name) ?? index + 1,
          rate: Number(group.rate),
        }))
      })

      return {
        professionCards: cards,
        professionGroups: groups,
      }
    }

    const rawRows = payoutsData
    const groupsMap = new Map<string, Map<string, { group: number; rate: number }>>()

    rawRows.forEach((row) => {
      const mappedCode = normalizeProfessionCode(row.profession_code)
      if (!mappedCode) return
      const rate = Number(row.rate ?? 0)
      if (!Number.isFinite(rate) || rate <= 0) return
      const groupNo = row.group_no !== null && row.group_no !== undefined ? Number(row.group_no) : null
      if (!groupsMap.has(mappedCode)) groupsMap.set(mappedCode, new Map())
      const byRate = groupsMap.get(mappedCode)!
      const key = `${groupNo ?? 0}-${rate}`
      if (!byRate.has(key)) {
        byRate.set(key, {
          group: Number.isFinite(groupNo) && groupNo !== null ? groupNo : byRate.size + 1,
          rate,
        })
      }
    })

    const groups: ProfessionGroupsViewModel = {}
    const cards = Array.from(groupsMap.entries())
      .map(([code, value]) => {
        const groupList = Array.from(value.values()).sort((a, b) => a.group - b.group)
        groups[code] = groupList
        return {
          code,
          label: resolveProfessionLabel(code, code),
          rates: groupList.map((item) => item.rate),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, "th"))

    return {
      professionCards: cards,
      professionGroups: groups,
    }
  }, [payoutsData, rateHierarchyData])

  useEffect(() => {
    if (!onAvailableProfessionsChange) return
    onAvailableProfessionsChange(
      professionCards.map((profession) => ({ code: profession.code, label: profession.label })),
    )
  }, [onAvailableProfessionsChange, professionCards])

  const itemByCitizenId = useMemo(() => {
    const map = new Map<string, PeriodDetail["items"][number]>()
    periodDetail?.items?.forEach((item) => {
      const citizenId = item.citizen_id ?? ""
      if (citizenId) map.set(citizenId, item)
    })
    return map
  }, [periodDetail?.items])

  const enrichedPayouts = useMemo(() => {
    const rows = payoutsData
    const month = Number(period?.period_month ?? 0)
    const rawYear = Number(period?.period_year ?? 0)
    const year = rawYear > 2400 ? rawYear - 543 : rawYear
    const daysInMonth = month > 0 && year > 0 ? new Date(year, month, 0).getDate() : 0

    return rows.map((row) => {
      const citizenId = row.citizen_id ?? ""
      const item = citizenId ? itemByCitizenId.get(citizenId) : undefined
      const title = row.title ?? "-"
      const firstName = row.first_name ?? item?.first_name ?? ""
      const lastName = row.last_name ?? item?.last_name ?? ""
      const positionName = row.position_name ?? item?.position_name ?? "-"
      const department = row.department ?? item?.current_department ?? "-"
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "-"

      const professionCode = normalizeProfessionCode(row.profession_code)

      const baseRate = Number(row.rate ?? 0)
      const retroactiveAmount = Number(row.retroactive_amount ?? 0)
      const totalAmount = Number(row.total_payable ?? 0)
      const leaveDays = Number(row.deducted_days ?? 0)
      const deductionAmount =
        daysInMonth > 0 && baseRate > 0 && leaveDays > 0
          ? Number(((baseRate / daysInMonth) * leaveDays).toFixed(2))
          : 0

      const note = row.remark ?? undefined
      const groupNoFromRow =
        row.group_no !== null && row.group_no !== undefined ? String(row.group_no) : "-"
      const groupNoFromRate = professionGroups[professionCode]
        ?.find((group) => group.rate === baseRate)
        ?.group?.toString()
      const groupNo = groupNoFromRow !== "-" ? groupNoFromRow : groupNoFromRate ?? "-"
      const rateGroup = groupNo
      const itemNo = row.item_no !== null && row.item_no !== undefined ? String(row.item_no) : "-"
      const subItemNo = row.sub_item_no !== null && row.sub_item_no !== undefined ? String(row.sub_item_no) : "-"
      const rowWithLicense = row as PeriodPayoutRow & {
        license_valid_until?: string | null
        license_status?: string | null
      }
      const licenseValidUntil = rowWithLicense.license_valid_until ?? null
      const licenseStatus = rowWithLicense.license_status ?? null
      const issues = buildIssues({ retroactiveAmount, deductionAmount, note, licenseValidUntil })
      const checkCount = Number(row.check_count ?? 0)
      const blockerCount = Number(row.blocker_count ?? 0)
      const warningCount = Number(row.warning_count ?? 0)

      return {
        id: row.payout_id,
        citizenId,
        eligibilityId:
          row.eligibility_id !== null && row.eligibility_id !== undefined ? Number(row.eligibility_id) : null,
        requestId: row.request_id ?? item?.request_id ?? null,
        title,
        name: fullName,
        position: positionName,
        department,
        professionCode,
        rateGroup,
        groupNo,
        itemNo,
        subItemNo,
        baseRate,
        retroactiveAmount,
        workDays: Number(row.eligible_days ?? 0),
        leaveDays,
        totalAmount,
        deductionAmount,
        licenseValidUntil,
        licenseStatus,
        issues,
        checkCount,
        blockerCount,
        warningCount,
        note,
      } satisfies PayrollRow
    })
  }, [itemByCitizenId, payoutsData, period?.period_month, period?.period_year, professionGroups])

  const filteredPersons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return enrichedPayouts.filter((person) => {
      const matchesSearch =
        !query ||
        person.name.toLowerCase().includes(query) ||
        person.department.toLowerCase().includes(query) ||
        person.position.toLowerCase().includes(query) ||
        person.citizenId.toLowerCase().includes(query)
      const matchesRate = rateFilter === "all" || person.groupNo === rateFilter
      const matchesDepartment = departmentFilter === "all" || person.department === departmentFilter
      const hasAttention = person.checkCount > 0 || person.issues.length > 0
      const matchesIssue =
        issueFilter === "all" ||
        (issueFilter === "clean" && !hasAttention) ||
        (issueFilter === "needs_attention" && hasAttention) ||
        (issueFilter === "blocker" && person.blockerCount > 0) ||
        (issueFilter === "warning" && person.warningCount > 0)
      const matchesProfession = selectedProfession === "all" || person.professionCode === selectedProfession
      return matchesSearch && matchesRate && matchesDepartment && matchesIssue && matchesProfession
    })
  }, [departmentFilter, enrichedPayouts, issueFilter, rateFilter, searchQuery, selectedProfession])

  const sortedPersons = useMemo(() => {
    const sorted = [...filteredPersons]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return a.name.localeCompare(b.name, "th")
        case "name_desc":
          return b.name.localeCompare(a.name, "th")
        case "department_asc":
          return a.department.localeCompare(b.department, "th")
        case "department_desc":
          return b.department.localeCompare(a.department, "th")
        case "amount_asc":
          return a.totalAmount - b.totalAmount
        case "amount_desc":
          return b.totalAmount - a.totalAmount
        case "rate_asc":
          return a.baseRate - b.baseRate
        case "rate_desc":
          return b.baseRate - a.baseRate
        default:
          return 0
      }
    })
    return sorted
  }, [filteredPersons, sortBy])

  const professionTotals = useMemo(() => {
    const totals = new Map<string, number>()
    professionCards.forEach((card) => totals.set(card.code, 0))
    enrichedPayouts.forEach((row) => {
      if (!totals.has(row.professionCode)) totals.set(row.professionCode, 0)
      totals.set(row.professionCode, (totals.get(row.professionCode) ?? 0) + row.totalAmount)
    })
    return totals
  }, [enrichedPayouts, professionCards])

  const displayStats = useMemo(() => {
    if (selectedProfession === "all") {
      return {
        count: Number(period?.total_headcount ?? 0),
        amount: Number(period?.total_amount ?? 0),
      }
    }
    const personsInProfession = enrichedPayouts.filter((person) => person.professionCode === selectedProfession)
    return {
      count: personsInProfession.length,
      amount: personsInProfession.reduce((sum, person) => sum + person.totalAmount, 0),
    }
  }, [enrichedPayouts, period?.total_amount, period?.total_headcount, selectedProfession])

  const activeProfessionLabel = useMemo(() => {
    if (selectedProfession === "all") return ""
    return professionCards.find((profession) => profession.code === selectedProfession)?.label ?? selectedProfession
  }, [professionCards, selectedProfession])

  const reviewedCodeSet = useMemo(
    () => new Set((reviewedProfessionCodes ?? []).map((code) => code.toUpperCase())),
    [reviewedProfessionCodes],
  )
  const totalProfessionCount = professionCards.length
  const reviewedCount = useMemo(
    () => professionCards.filter((profession) => reviewedCodeSet.has(profession.code.toUpperCase())).length,
    [professionCards, reviewedCodeSet],
  )
  const currentProfessionReviewed =
    selectedProfession !== "all" && reviewedCodeSet.has(selectedProfession.toUpperCase())
  const remainingProfessions = useMemo(
    () => professionCards.filter((profession) => !reviewedCodeSet.has(profession.code.toUpperCase())),
    [professionCards, reviewedCodeSet],
  )
  const canSubmitReview =
    !!onSubmitForReview &&
    selectedProfession !== "all" &&
    totalProfessionCount > 0 &&
    reviewedCount === totalProfessionCount

  const availableGroups = useMemo(() => {
    const rows =
      selectedProfession === "all"
        ? enrichedPayouts
        : enrichedPayouts.filter((row) => row.professionCode === selectedProfession)
    const groups = new Set<string>()
    rows.forEach((row) => {
      if (row.groupNo !== "-" && row.groupNo) groups.add(row.groupNo)
    })
    return Array.from(groups).sort((a, b) => Number(a) - Number(b))
  }, [enrichedPayouts, selectedProfession])

  const availableDepartments = useMemo(() => {
    const rows =
      selectedProfession === "all"
        ? enrichedPayouts
        : enrichedPayouts.filter((row) => row.professionCode === selectedProfession)
    const departments = Array.from(
      new Set(rows.map((row) => row.department).filter((value) => Boolean(value && value !== "-"))),
    )
    return departments.sort((a, b) => a.localeCompare(b, "th"))
  }, [enrichedPayouts, selectedProfession])

  return {
    searchQuery,
    setSearchQuery,
    rateFilter,
    setRateFilter,
    departmentFilter,
    setDepartmentFilter,
    issueFilter,
    setIssueFilter,
    sortBy,
    setSortBy,
    isSelectorExpanded,
    setIsSelectorExpanded,
    professionCards,
    professionGroups,
    enrichedPayouts,
    filteredPersons,
    sortedPersons,
    professionTotals,
    displayStats,
    activeProfessionLabel,
    reviewedCodeSet,
    currentProfessionReviewed,
    remainingProfessions,
    canSubmitReview,
    availableGroups,
    availableDepartments,
  }
}
