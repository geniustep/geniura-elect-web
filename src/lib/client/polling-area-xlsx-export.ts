"use client";

import ExcelJS from "@andreeewill/exceljs/dist/exceljs.min.js";

export type PollingAreaExportRow = {
  compensation?: number | null;
  phone?: string | null;
  voterNumber?: string | null;
  rbo?: string | null;
  observerName?: string | null;
  registeredVoters?: number | null;
  officeNumber: number;
  pollingCenterName: string;
  centralOfficeName?: string | null;
  centralOfficeNumber?: number | null;
  hasRepresentative: boolean;
};

const exactHeaders = [
  "التعويض",
  "رقم الهاتف",
  "رقم الناخب",
  "ر ب و",
  "إسم المراقب",
  "عدد المسجَّلين",
  "رقم مكتب \nالتصويت",
  "عنوان مكتب التصويت",
  "عنوان المكتب المركزي",
  "رقم المكتب \nالمركزي",
];

const BLACK = "FF000000";
const HEADER_BLUE = "FF95B3D7";
const EMPTY_OBSERVER_GRAY = "FFD9D9D9";
const TITLE_BORDER = "FFBFBFBF";

const thinBlack = {
  top: { style: "thin" as const, color: { argb: BLACK } },
  bottom: { style: "thin" as const, color: { argb: BLACK } },
  left: { style: "thin" as const, color: { argb: BLACK } },
  right: { style: "thin" as const, color: { argb: BLACK } },
};

function electionDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "ماي",
    "يونيو",
    "يوليوز",
    "غشت",
    "شتنبر",
    "أكتوبر",
    "نونبر",
    "دجنبر",
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function applyCellBase(cell: ExcelJS.Cell) {
  cell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: BLACK },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  cell.border = thinBlack;
}

function buildAreaSheet(
  workbook: ExcelJS.Workbook,
  electionDate: string,
  rows: PollingAreaExportRow[],
) {
  const worksheet = workbook.addWorksheet("معطيات المراقبين");

  worksheet.properties.defaultRowHeight = 33.95;
  worksheet.columns = [
    { width: 12.5, hidden: true },
    { width: 13.625 },
    { width: 11.5 },
    { width: 12.375 },
    { width: 17.5 },
    { width: 11.5 },
    { width: 9.625 },
    { width: 21.625 },
    { width: 20.5 },
    { width: 11.125 },
  ];

  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 13.5;
  worksheet.getRow(4).height = 33.95;

  for (let row = 1; row <= 2; row += 1) {
    for (let col = 4; col <= 9; col += 1) {
      const cell = worksheet.getRow(row).getCell(col);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: TITLE_BORDER } },
        bottom: { style: "thin", color: { argb: TITLE_BORDER } },
        left: { style: "thin", color: { argb: TITLE_BORDER } },
        right: { style: "thin", color: { argb: TITLE_BORDER } },
      };
    }
  }

  worksheet.mergeCells("D1:I2");
  const title = worksheet.getCell("D1");
  title.value =
    "لائحة المراقبين بمكاتب التصويت للانتخابات التشريعية\n" +
    `اقتراع ${electionDateLabel(electionDate)}`;
  title.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: BLACK },
  };
  title.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  const header = worksheet.getRow(4);
  exactHeaders.forEach((value, index) => {
    const cell = header.getCell(index + 1);
    cell.value = value;
    applyCellBase(cell);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_BLUE },
    };
  });

  const sortedRows = [...rows].sort(
    (left, right) => left.officeNumber - right.officeNumber,
  );

  sortedRows.forEach((item, index) => {
    const rowNumber = index + 5;
    const row = worksheet.getRow(rowNumber);
    row.height = 33.95;

    row.values = [
      item.compensation ?? "",
      item.phone ?? "",
      item.voterNumber ?? "",
      item.rbo ?? "",
      item.observerName ?? "",
      item.registeredVoters ?? "",
      item.officeNumber,
      item.pollingCenterName,
      item.centralOfficeName ?? "",
      item.centralOfficeNumber ?? "",
    ];

    for (let col = 1; col <= 10; col += 1) {
      applyCellBase(row.getCell(col));
    }

    if (!item.hasRepresentative) {
      for (let col = 2; col <= 5; col += 1) {
        row.getCell(col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: EMPTY_OBSERVER_GRAY },
        };
      }
    }
  });

  let groupStart = 5;
  let currentKey = sortedRows[0]?.centralOfficeNumber
    ? `${sortedRows[0].centralOfficeNumber}|${sortedRows[0].centralOfficeName ?? ""}`
    : "";

  for (let index = 1; index <= sortedRows.length; index += 1) {
    const item = sortedRows[index];
    const nextKey = item?.centralOfficeNumber
      ? `${item.centralOfficeNumber}|${item.centralOfficeName ?? ""}`
      : "";

    if (currentKey && nextKey === currentKey) continue;

    const endRow = index + 4;
    if (currentKey && endRow > groupStart) {
      worksheet.mergeCells(`I${groupStart}:I${endRow}`);
      worksheet.mergeCells(`J${groupStart}:J${endRow}`);
      worksheet.getCell(`I${groupStart}`).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      worksheet.getCell(`J${groupStart}`).alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }

    groupStart = index + 5;
    currentKey = nextKey;
  }

  const lastRow = Math.max(5, sortedRows.length + 4);
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    scale: 81,
    horizontalCentered: true,
    verticalCentered: true,
    printArea: `B1:J${lastRow}`,
    printTitlesRow: "1:4",
    margins: {
      left: 0.11811023622047245,
      right: 0.31496062992125984,
      top: 0.15748031496062992,
      bottom: 0.15748031496062992,
      header: 0.31496062992125984,
      footer: 0.31496062992125984,
    },
  };

  workbook.addWorksheet("Sheet3");

  return worksheet;
}

function safeFilename(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, " ").trim();
  return cleaned || "معطيات المراقبين";
}

export async function downloadPollingAreaWorkbook({
  areaName,
  sourceFilename,
  electionDate,
  rows,
}: {
  areaName: string;
  sourceFilename?: string | null;
  electionDate: string;
  rows: PollingAreaExportRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  buildAreaSheet(workbook, electionDate, rows);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;

  const preferred = sourceFilename?.toLowerCase().endsWith(".xlsx")
    ? sourceFilename.slice(0, -5)
    : sourceFilename || areaName;
  anchor.download = `${safeFilename(preferred)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
